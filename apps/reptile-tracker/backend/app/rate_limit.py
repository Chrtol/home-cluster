"""
M-2 Fix: Rate limiting implementation
Protects against brute force attacks and API abuse
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
import logging

logger = logging.getLogger(__name__)

# Create limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute", "2000/hour"],
    storage_uri="memory://",  # In production, use Redis for distributed rate limiting
    headers_enabled=True,
)


def get_rate_limiter():
    """Get the rate limiter instance"""
    return limiter


# Custom rate limit exceeded handler
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Log rate limit violations"""
    logger.warning(
        f"Rate limit exceeded for IP: {get_remote_address(request)} "
        f"on path: {request.url.path}"
    )
    return _rate_limit_exceeded_handler(request, exc)
