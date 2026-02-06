"""
Scheduler package for notification and autocomplete job management.

This package is part of Phase 2 incremental extraction from the original scheduler.py.
Job management functions are extracted here, while the global scheduler instance
and lifecycle functions remain in the parent scheduler.py module.

Note: Do NOT import from app.scheduler here - that would create a circular import.
The parent scheduler.py will import and re-export these functions instead.
"""

# Export job management functions from jobs.py
from .jobs import (
    schedule_notification_jobs_for_schedule,
    schedule_notifications_for_interval_instance,
    cancel_notification_jobs_for_schedule,
    reschedule_notification_jobs_for_schedule,
)

__all__ = [
    "schedule_notification_jobs_for_schedule",
    "schedule_notifications_for_interval_instance",
    "cancel_notification_jobs_for_schedule",
    "reschedule_notification_jobs_for_schedule",
]
