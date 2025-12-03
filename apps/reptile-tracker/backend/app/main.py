import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.sessions import SessionMiddleware
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.database import init_db, async_session_maker
from app.rate_limit import limiter, rate_limit_exceeded_handler
from app.routers import auth, reptiles, feedings, foods, supplements, weight, health, stats, misting, schedules, feeding_rotations, schedule_templates, supplement_rotation_templates
from app.routers import households, invitations, notification_settings, notification_channels
from app.seed_data import seed_database
from app.scheduler import start_scheduler, stop_scheduler

# Security fixes applied:
# - M-1: CSRF protection via SameSite cookies (configured in auth.py)
# - M-2: Rate limiting on all endpoints
# - I-3: Security logging

# Configure logging - note: uvicorn logging is configured via logging_config.json
# passed to uvicorn via --log-config flag
# Health check filter is defined in app.logging_filters
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Reptile Tracker API",
    description="API for tracking reptile feeding schedules, health, and weight",
    version="2.0.1",  # Testing CI/CD with timestamp-based image tags
    redirect_slashes=False,  # Disable automatic slash redirects to avoid 307s that break auth cookies
)

# M-2 Fix: Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Session middleware - required for OAuth/OIDC flow
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    max_age=3600,  # 1 hour session for OAuth state
    same_site="lax",
    https_only=settings.cookie_secure
)

# CORS middleware
# M-1 Note: CSRF protection is handled via SameSite cookies
# Since we're using HTTP-only SameSite cookies, traditional CSRF tokens aren't needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,  # Required for cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Note: TrustedHostMiddleware disabled - host validation handled by nginx-ingress
# The middleware was causing issues with Kubernetes health probes and internal service calls
# Security is maintained via ingress controller which validates Host headers at the edge

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(reptiles.router, prefix="/api/reptiles", tags=["Reptiles"])
app.include_router(feedings.router, prefix="/api/feedings", tags=["Feedings"])
app.include_router(foods.router, prefix="/api/foods", tags=["Foods"])
app.include_router(supplements.router, prefix="/api/supplements", tags=["Supplements"])
app.include_router(weight.router, prefix="/api/weight", tags=["Weight Tracking"])
app.include_router(health.router, prefix="/api/health", tags=["Health Records"])
app.include_router(misting.router, prefix="/api/misting", tags=["Misting Logs"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["Schedules"])
app.include_router(feeding_rotations.router, prefix="/api/feeding-rotations", tags=["Feeding Rotations"])
app.include_router(schedule_templates.router)
app.include_router(schedule_templates.guidelines_router)
app.include_router(supplement_rotation_templates.router)
app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
app.include_router(households.router)
app.include_router(invitations.router)
app.include_router(notification_settings.router)
app.include_router(notification_channels.router, prefix="/api/notification-channels", tags=["Notification Channels"])


@app.on_event("startup")
async def startup_event():
    """Initialize database and log startup"""
    logger.info(f"Starting Reptile Tracker API v2.0.0 in {settings.environment} mode")

    # H-2 Fix: Validate secret key on startup
    if settings.secret_key in ["your-secret-key-here-change-in-production", "dev_secret_key_change_in_production"]:
        logger.error("SECURITY ERROR: Default secret key detected!")
        raise ValueError("Default secret key detected. Set SECRET_KEY environment variable.")

    logger.info(f"Security settings: cookie_secure={settings.cookie_secure}, sql_echo={settings.sql_echo}")

    await init_db()
    logger.info("Database initialized successfully")

    # Seed default foods and supplements on startup
    async with async_session_maker() as session:
        await seed_database(session)
    logger.info("Default foods and supplements seeded")

    # Clean up duplicate templates after seeding
    async with async_session_maker() as session:
        from app.cleanup_templates import cleanup_duplicate_templates
        deleted_count = await cleanup_duplicate_templates(session)
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} duplicate templates")
        else:
            logger.info("No duplicate templates found")

    # Start notification scheduler
    start_scheduler()
    logger.info("Notification scheduler started")


@app.on_event("shutdown")
async def shutdown_event():
    """Log shutdown"""
    logger.info("Shutting down Reptile Tracker API")

    # Stop notification scheduler
    stop_scheduler()
    logger.info("Notification scheduler stopped")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Reptile Tracker API",
        "version": "2.0.0",
        "docs": "/docs",
        "security_updates": [
            "Secure cookie-based authentication",
            "Rate limiting enabled",
            "SSRF protection on webhooks",
            "Enhanced logging",
            "Short-lived access tokens"
        ]
    }


@app.get("/health")
async def health_check():
    """Health check endpoint - no rate limiting for Kubernetes probes"""
    return {
        "status": "healthy",
        "environment": settings.environment,
        "version": "2.0.0"
    }
