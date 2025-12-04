"""
Celery configuration for reliable notification delivery
"""
import os
from celery import Celery
from app.config import settings

# Build Redis URL from environment variables
# Priority: REDIS_URL > individual components > default
REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    # Build from individual components
    redis_host = os.getenv("REDIS_HOST", "dragonfly.database.svc.cluster.local")
    redis_port = os.getenv("REDIS_PORT", "6379")
    redis_password = os.getenv("REDIS_PASSWORD", "")
    redis_db = os.getenv("REDIS_DB", "0")

    if redis_password:
        REDIS_URL = f"redis://:{redis_password}@{redis_host}:{redis_port}/{redis_db}"
    else:
        REDIS_URL = f"redis://{redis_host}:{redis_port}/{redis_db}"

# Create Celery app
celery_app = Celery(
    "reptile_tracker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.celery_tasks"]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    task_soft_time_limit=240,  # Soft limit at 4 minutes
    worker_prefetch_multiplier=1,  # Process one task at a time
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks
    task_acks_late=True,  # Only ack after task completes
    task_reject_on_worker_lost=True,  # Requeue if worker dies
    result_expires=3600,  # Results expire after 1 hour
    broker_connection_retry_on_startup=True,
)

# Task routing - all notification tasks go to 'notifications' queue
celery_app.conf.task_routes = {
    "app.celery_tasks.send_schedule_reminder_task": {"queue": "notifications"},
    "app.celery_tasks.send_overdue_alert_task": {"queue": "notifications"},
}
