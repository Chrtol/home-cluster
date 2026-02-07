"""
Scheduler package for notification and job management.

This package provides the global scheduler instance and job management functions.
All imports should be done via this package (from app.scheduler import ...).

Structure:
- core.py: Global scheduler instance, lifecycle, wrapper functions, utilities
- jobs.py: Extracted notification job functions (accept scheduler as parameter)
- auto_complete.py: Extracted auto-complete job functions (accept scheduler as parameter)
- notifications.py: Extracted notification sender functions (send reminders, overdue alerts, interval warnings)
"""

# Re-export everything from core.py for backward compatibility
from .core import (
    # Global instance
    scheduler,
    # Lifecycle
    start_scheduler,
    stop_scheduler,
    # Wrapper functions (these pass scheduler to jobs.py functions)
    schedule_notification_jobs_for_schedule,
    schedule_notifications_for_interval_instance,
    cancel_notification_jobs_for_schedule,
    reschedule_notification_jobs_for_schedule,
    # Callbacks and utilities used by jobs.py and other modules
    execute_scheduled_notification,
    should_schedule_occur_on_date,
    create_in_app_notification,
    send_schedule_reminder,
    send_overdue_alert,
    send_interval_warning_notification,
    is_within_quiet_hours,
    schedule_autocomplete_for_instance,
)

__all__ = [
    "scheduler",
    "start_scheduler",
    "stop_scheduler",
    "schedule_notification_jobs_for_schedule",
    "schedule_notifications_for_interval_instance",
    "cancel_notification_jobs_for_schedule",
    "reschedule_notification_jobs_for_schedule",
    "execute_scheduled_notification",
    "should_schedule_occur_on_date",
    "create_in_app_notification",
    "send_schedule_reminder",
    "send_overdue_alert",
    "send_interval_warning_notification",
    "is_within_quiet_hours",
    "schedule_autocomplete_for_instance",
]
