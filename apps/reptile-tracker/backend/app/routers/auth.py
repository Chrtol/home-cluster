import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status, Cookie
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import (
    oauth,
    create_access_token,
    create_refresh_token,
    set_auth_cookies,
    clear_auth_cookies,
    get_or_create_user,
    get_current_user,
)
from app.config import settings
from app.database import get_db
from app.schemas import User, UserUpdate
from app.rate_limit import limiter
import jwt
from sqlalchemy import select, update
from app import models
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/login")
@limiter.limit("10/minute")
async def login(request: Request):
    """Initiate OIDC login flow"""
    logger.info("OIDC login initiated")
    # Preserve an optional `next` parameter so we can redirect users back after auth
    next_url = request.query_params.get('next')
    if next_url:
        request.session['next'] = next_url
    redirect_uri = settings.oidc_redirect_uri
    return await oauth.authentik.authorize_redirect(request, redirect_uri)


@router.get("/callback")
@limiter.limit("20/minute")
async def auth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle OIDC callback
    Sets secure HTTP-only cookies instead of passing token in URL
    """
    try:
        token = await oauth.authentik.authorize_access_token(request)
        user_info = token.get("userinfo")

        if not user_info:
            logger.error("OIDC callback failed: No user info in token")
            raise HTTPException(status_code=400, detail="Failed to get user info")

        # Get or create user
        user = await get_or_create_user(db, user_info)

        # Create JWT tokens
        access_token = create_access_token(data={"sub": user.oidc_sub})
        refresh_token = create_refresh_token(data={"sub": user.oidc_sub})

        # Determine redirect target (respect stored `next` in session)
        next_url = request.session.pop('next', None)
        target = f"{settings.frontend_url}/" if not next_url else f"{settings.frontend_url}{next_url}"

        # If next_url contains an invitation code (e.g. /accept-invite?code=XYZ),
        # attempt to accept the invitation server-side so the user is immediately a member.
        try:
            if next_url and 'code=' in next_url:
                # parse code
                parsed = urlparse(next_url)
                qs = parse_qs(parsed.query)
                code = qs.get('code', [None])[0]
                if code:
                    # Validate invitation
                    result = await db.execute(select(models.Invitation).where(models.Invitation.code == code))
                    inv = result.scalar_one_or_none()
                    from datetime import datetime, timezone
                    now = datetime.now(timezone.utc)
                    if inv and (not inv.expires_at or inv.expires_at > now) and (not inv.max_uses or inv.used_count < inv.max_uses):
                        # Add membership
                        await db.execute(models.household_members.insert().values(household_id=inv.household_id, user_id=user.id, access_level=models.AccessLevel.CARETAKER))
                        await db.execute(update(models.Invitation).where(models.Invitation.id == inv.id).values(used_count=inv.used_count + 1))
                        await db.commit()
        except Exception as e:
            logger.warning(f"Auto-accept invite failed: {e}")

        # Create the response object first
        response = RedirectResponse(url=target, status_code=302)

        # Set cookies on the response object that will actually be returned
        set_auth_cookies(response, access_token, refresh_token)

        logger.info(f"User {user.email} authenticated successfully via OIDC")

        return response

    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        # Provide a more specific error for the CSRF case
        if "mismatching_state" in str(e):
             raise HTTPException(
                status_code=400,
                detail="CSRF Warning: State mismatch. Please try logging in again."
             )
        raise HTTPException(
            status_code=400,
            detail="Authentication failed. Please try again."
        )


@router.post("/refresh")
@limiter.limit("30/minute")
async def refresh_token(
    request: Request,
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using refresh token
    """
    if not refresh_token:
        logger.warning("Token refresh failed: No refresh token provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not provided"
        )

    try:
        # Decode and validate refresh token
        payload = jwt.decode(refresh_token, settings.secret_key, algorithms=["HS256"])
        oidc_sub = payload.get("sub")
        token_type = payload.get("type")

        if token_type != "refresh":
            logger.warning("Token refresh failed: Invalid token type")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )

        # Verify user exists
        from sqlalchemy import select
        from app.models import User as UserModel

        result = await db.execute(select(UserModel).where(UserModel.oidc_sub == oidc_sub))
        user = result.scalar_one_or_none()

        if not user:
            logger.warning(f"Token refresh failed: User not found for sub: {oidc_sub}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        # Create new tokens
        new_access_token = create_access_token(data={"sub": user.oidc_sub})
        new_refresh_token = create_refresh_token(data={"sub": user.oidc_sub})

        # Create a new response to set cookies
        response = RedirectResponse(url="/", status_code=200)

        # Set new cookies
        set_auth_cookies(response, new_access_token, new_refresh_token)

        logger.info(f"Token refreshed successfully for user: {user.email}")

        return response

    except jwt.ExpiredSignatureError:
        logger.info("Token refresh failed: Refresh token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired. Please log in again."
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Token refresh failed: Invalid token - {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user


@router.patch("/me", response_model=User)
async def update_me(
    user_update: UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user info (e.g., timezone)"""
    # Update user fields
    if user_update.name is not None:
        current_user.name = user_update.name
    if user_update.timezone is not None:
        # Validate timezone string
        try:
            from zoneinfo import ZoneInfo
            ZoneInfo(user_update.timezone)  # Will raise if invalid
            current_user.timezone = user_update.timezone
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timezone: {user_update.timezone}"
            )

    await db.commit()
    await db.refresh(current_user)

    logger.info(f"User {current_user.email} updated their profile")
    return current_user


@router.post("/logout")
async def logout(response: RedirectResponse):
    """
    Logout - clear authentication cookies
    """
    clear_auth_cookies(response)
    logger.info("User logged out")
    return {"message": "Logged out successfully"}