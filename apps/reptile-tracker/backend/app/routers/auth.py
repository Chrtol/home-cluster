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
from app.schemas import User
from app.rate_limit import limiter
import jwt

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/login")
@limiter.limit("10/minute")
async def login(request: Request):
    """Initiate OIDC login flow"""
    logger.info("OIDC login initiated")
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

        # Create the response object first
        response = RedirectResponse(url=f"{settings.frontend_url}/", status_code=302)

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


@router.post("/logout")
async def logout(response: RedirectResponse):
    """
    Logout - clear authentication cookies
    """
    clear_auth_cookies(response)
    logger.info("User logged out")
    return {"message": "Logged out successfully"}