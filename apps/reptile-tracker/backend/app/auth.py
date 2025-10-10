from datetime import datetime, timedelta, timezone
from typing import Optional
import logging
from fastapi import Depends, HTTPException, status, Cookie, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from authlib.integrations.starlette_client import OAuth
from app.config import settings
from app.database import get_db
from app.models import User

# Security fixes applied:
# - H-1: Using secure cookies instead of URL parameters
# - L-2: Reduced token expiration to 15 minutes
# - I-1: Replaced datetime.utcnow() with datetime.now(timezone.utc)
# - I-3: Added security logging

logger = logging.getLogger(__name__)

# JWT settings
ALGORITHM = "HS256"

# OAuth setup
oauth = OAuth()
oauth.register(
    name="authentik",
    client_id=settings.oidc_client_id,
    client_secret=settings.oidc_client_secret,
    server_metadata_url=settings.oidc_discovery_url,
    client_kwargs={"scope": "openid email profile"},
)

security = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token with configurable expiration"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    })

    # Validate secret key is not default
    if settings.secret_key in ["your-secret-key-here-change-in-production", "dev_secret_key_change_in_production"]:
        raise ValueError("SECURITY ERROR: Default secret key detected. Change SECRET_KEY environment variable.")

    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token with longer expiration"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh"
    })

    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """
    H-1 Fix: Set secure HTTP-only cookies instead of passing tokens in URL
    """
    # Access token cookie (short-lived)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.access_token_expire_minutes * 60,
        domain=settings.cookie_domain,
    )

    # Refresh token cookie (longer-lived)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        domain=settings.cookie_domain,
    )


def clear_auth_cookies(response: Response):
    """Clear authentication cookies on logout"""
    response.delete_cookie("access_token", domain=settings.cookie_domain)
    response.delete_cookie("refresh_token", domain=settings.cookie_domain)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get current user from JWT token (supports both Bearer token and secure cookie)
    M-4 Fix: Improved exception handling with specific errors
    """
    # Try to get token from Authorization header first, then fall back to cookie
    token = None
    if credentials:
        token = credentials.credentials
    elif access_token:
        token = access_token

    if not token:
        logger.warning("Authentication failed: No token provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        oidc_sub: str = payload.get("sub")
        token_type: str = payload.get("type")

        if oidc_sub is None:
            logger.warning("Authentication failed: Missing subject in token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
            )

        if token_type != "access":
            logger.warning(f"Authentication failed: Wrong token type: {token_type}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

    except jwt.ExpiredSignatureError:
        logger.info(f"Authentication failed: Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Authentication failed: Invalid token - {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.oidc_sub == oidc_sub))
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning(f"Authentication failed: User not found for sub: {oidc_sub}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    logger.info(f"User authenticated successfully: {user.email}")
    return user


async def get_or_create_user(db: AsyncSession, user_info: dict) -> User:
    """
    Get or create user from OIDC user info
    I-1 Fix: Using timezone-aware datetime
    M-4 Fix: Better error handling
    """
    oidc_sub = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name", email)

    if not oidc_sub or not email:
        logger.error("Failed to create user: Missing required OIDC claims")
        raise ValueError("Missing required OIDC claims (sub or email)")

    try:
        # Check if user exists
        result = await db.execute(select(User).where(User.oidc_sub == oidc_sub))
        user = result.scalar_one_or_none()

        if user:
            # Update last login
            user.last_login = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(user)
            logger.info(f"User logged in: {user.email}")
        else:
            # Create new user
            user = User(
                oidc_sub=oidc_sub,
                email=email,
                name=name,
                created_at=datetime.now(timezone.utc),
                last_login=datetime.now(timezone.utc),
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            logger.info(f"New user created: {user.email}")

        return user
    except Exception as e:
        logger.error(f"Failed to create/update user: {str(e)}")
        await db.rollback()
        raise
