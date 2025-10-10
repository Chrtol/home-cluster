import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Cookie
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

# Security fixes:
# - H-1: Using secure cookies instead of URL query parameters
# - M-2: Rate limiting on authentication endpoints
# - M-4: Better exception handling
# - I-3: Security logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/login")
@limiter.limit("10/minute")  # M-2 Fix: Rate limit login attempts
async def login(request: Request):
    """Initiate OIDC login flow"""
    logger.info("OIDC login initiated")
    redirect_uri = settings.oidc_redirect_uri
    return await oauth.authentik.authorize_redirect(request, redirect_uri)


@router.get("/callback")
@limiter.limit("20/minute")  # M-2 Fix: Rate limit callbacks
async def auth_callback(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle OIDC callback
    H-1 Fix: Sets secure HTTP-only cookies instead of passing token in URL
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

        # H-1 Fix: Set secure cookies instead of URL parameter
        set_auth_cookies(response, access_token, refresh_token)

        logger.info(f"User {user.email} authenticated successfully via OIDC")

        # Redirect to frontend auth callback to complete login flow
        # Cookies are set in the response headers
        return RedirectResponse(url=f"{settings.frontend_url}/", status_code=302)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Authentication failed. Please try again."
        )


@router.post("/refresh")
@limiter.limit("30/minute")  # M-2 Fix: Rate limit token refresh
async def refresh_token(
    request: Request,
    response: Response,
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using refresh token
    L-2 Fix: Enables short-lived access tokens with refresh mechanism
    """
    import jwt

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
        from app.models import User

        result = await db.execute(select(User).where(User.oidc_sub == oidc_sub))
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

        # Set new cookies
        set_auth_cookies(response, new_access_token, new_refresh_token)

        logger.info(f"Token refreshed successfully for user: {user.email}")

        return {"message": "Token refreshed successfully"}

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
async def logout(response: Response):
    """
    Logout - clear authentication cookies
    H-1 Fix: Clear secure cookies
    """
    clear_auth_cookies(response)
    logger.info("User logged out")
    return {"message": "Logged out successfully"}
