"""
Local authentication router for username/password login and dev user switching.

This router provides:
- POST /auth/local - Local username/password authentication (when LOCAL_AUTH_ENABLED=true)
- POST /auth/dev/switch - Dev user switching (development environment only)
- GET /auth/dev/users - List all users for dev switcher dropdown (development environment only)

Security notes:
- T-35-05: Uses bcrypt for password hashing via passlib
- T-35-06: /auth/dev/* endpoints return 403 in non-development environments
- T-35-07: password_hash is never included in API responses
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import create_access_token, create_refresh_token, set_auth_cookies
from app.config import settings
from app.database import get_db
from app.models import User, AccessLevel, reptile_access, household_members

logger = logging.getLogger(__name__)

router = APIRouter()

# Password hashing context - bcrypt is industry standard
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


# === Schemas ===

class LocalLoginSchema(BaseModel):
    """Schema for local authentication request."""
    username: str  # Email address
    password: str


class UserListItem(BaseModel):
    """Schema for user list item (dev switcher dropdown)."""
    id: int
    email: str
    name: str
    access_level: Optional[str] = None  # Primary household access level

    class Config:
        from_attributes = True


class LocalLoginResponse(BaseModel):
    """Schema for successful login response."""
    message: str
    user: UserListItem


# === Endpoints ===

@router.post("/auth/local", response_model=LocalLoginResponse)
async def local_login(
    credentials: LocalLoginSchema,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user with email/password (local authentication).

    Per D-12: Only available when LOCAL_AUTH_ENABLED is true.
    Returns 403 if local auth is disabled.
    Sets JWT cookies on successful authentication.
    """
    # Check if local auth is enabled
    if not settings.local_auth_enabled:
        logger.warning("Local auth attempt when LOCAL_AUTH_ENABLED is false")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Local authentication is not enabled"
        )

    # Query user by email
    result = await db.execute(
        select(User).where(User.email == credentials.username)
    )
    user = result.scalar_one_or_none()

    if not user:
        logger.warning(f"Local auth failed: user not found for email {credentials.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Check if user has a password set (OIDC-only users don't)
    if not user.password_hash:
        logger.warning(f"Local auth failed: no password set for user {credentials.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        logger.warning(f"Local auth failed: invalid password for user {credentials.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Issue JWT tokens
    access_token = create_access_token(data={"sub": user.oidc_sub})
    refresh_token = create_refresh_token(data={"sub": user.oidc_sub})

    # Set authentication cookies
    set_auth_cookies(response, access_token, refresh_token)

    logger.info(f"User {user.email} authenticated successfully via local auth")

    return LocalLoginResponse(
        message="Login successful",
        user=UserListItem(
            id=user.id,
            email=user.email,
            name=user.name,
            access_level=None  # Not needed for login response
        )
    )


@router.post("/auth/dev/switch")
async def dev_switch_user(
    user_id: int,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Switch to a different user session (development environment only).

    Per D-17: Only available in development environment.
    Returns 403 in non-development environments.
    No password required - just switches to the target user.
    """
    # Environment check - critical security gate
    if settings.environment != "development":
        logger.warning("Dev switch attempt in non-development environment")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev user switching is only available in development environment"
        )

    # Query target user
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Issue new JWT tokens for target user
    access_token = create_access_token(data={"sub": target_user.oidc_sub})
    refresh_token = create_refresh_token(data={"sub": target_user.oidc_sub})

    # Set authentication cookies
    set_auth_cookies(response, access_token, refresh_token)

    logger.info(f"Dev switch: switched to user {target_user.email}")

    return {
        "message": "Switched user successfully",
        "user": {
            "id": target_user.id,
            "email": target_user.email,
            "name": target_user.name
        }
    }


@router.get("/auth/dev/users", response_model=List[UserListItem])
async def get_dev_users(db: AsyncSession = Depends(get_db)):
    """
    Get list of all users for dev switcher dropdown.

    Per D-17: Only available in development environment.
    Returns users with their primary household access level.
    """
    # Environment check - critical security gate
    if settings.environment != "development":
        logger.warning("Dev users list attempt in non-development environment")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev user list is only available in development environment"
        )

    # Query all users
    result = await db.execute(select(User).order_by(User.email))
    users = result.scalars().all()

    # Get household memberships to determine access levels
    user_access_levels = {}
    for user in users:
        # Get user's household memberships
        membership_result = await db.execute(
            select(household_members.c.access_level)
            .where(household_members.c.user_id == user.id)
            .limit(1)  # Just get first/primary household
        )
        membership = membership_result.first()
        if membership:
            user_access_levels[user.id] = membership[0].value if hasattr(membership[0], 'value') else membership[0]

    return [
        UserListItem(
            id=user.id,
            email=user.email,
            name=user.name,
            access_level=user_access_levels.get(user.id)
        )
        for user in users
    ]
