"""
Scheduler package for notification and job management.

This package provides the global scheduler instance and job management functions.
All imports should be done via this package (from app.scheduler import ...).

Structure:
- core.py: Global scheduler instance, lifecycle, wrapper functions, utilities
- jobs.py: Extracted notification job functions (accept scheduler as parameter)
- auto_complete.py: Extracted auto-complete job functions (accept scheduler as parameter)
- notifications.py: Extracted notification sender functions (send reminders, overdue alerts, interval warnings)
- overdue.py: Extracted overdue detection functions
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
    # On-demand planner scheduling (Phase 23 fix)
    schedule_planner_for_user,
)

# Re-export overdue detection from overdue.py
from .overdue import check_overdue_schedules

# Re-export digest functions from digest.py (Phase 23 - Notification Planner)
from .digest import (
    get_pending_instances_for_date,
    get_overdue_instances_for_user,
    get_weekly_instances,
    build_daily_digest_message,
    build_weekly_digest_message,
    build_task_line,
    build_individual_task_message,
)

# Re-export weight alert functions from weight_alerts.py (Phase 24 - Weight Change Alerts)
from .weight_alerts import (
    check_weight_change_alert,
    is_weight_alert_cap_reached,
    get_baseline_weight,
    get_rolling_average_baseline,
    update_weight_alert_tracking,
    get_threshold_for_direction,
    get_age_category_for_reptile,
    get_age_aware_defaults_for_reptile,
    get_effective_cooldown_days,
    AGE_AWARE_DEFAULTS,
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
    "check_overdue_schedules",
    # On-demand planner scheduling (Phase 23 fix)
    "schedule_planner_for_user",
    # Digest functions (Phase 23)
    "get_pending_instances_for_date",
    "get_overdue_instances_for_user",
    "get_weekly_instances",
    "build_daily_digest_message",
    "build_weekly_digest_message",
    "build_task_line",
    "build_individual_task_message",
    # Weight alert functions (Phase 24)
    "check_weight_change_alert",
    "is_weight_alert_cap_reached",
    "get_baseline_weight",
    "get_rolling_average_baseline",
    "update_weight_alert_tracking",
    "get_threshold_for_direction",
    "get_age_category_for_reptile",
    "get_age_aware_defaults_for_reptile",
    "get_effective_cooldown_days",
    "AGE_AWARE_DEFAULTS",
]
