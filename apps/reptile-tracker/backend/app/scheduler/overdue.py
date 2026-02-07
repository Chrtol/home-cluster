"""
Overdue detection logic for the notification scheduler.

This module contains the check_overdue_schedules function, extracted from core.py
as part of Phase 4 refactoring. It handles detection of missed schedule occurrences
and sends overdue alerts through configured notification channels.

Purpose: Isolated overdue detection logic for better maintainability and testability.
"""
import logging
from datetime import datetime, timezone, timedelta, date as py_date
from sqlalchemy import select, and_, or_
from fastapi import HTTPException

from app.database import async_session_maker
from app.models import Schedule, ScheduleCompletion, Reptile, User, NotificationSettings, NotificationType, CompletionStatus

# Import utilities and notification senders
from .core import is_within_quiet_hours
from .notifications import send_overdue_alert

logger = logging.getLogger(__name__)


async def check_overdue_schedules():
    """Check for overdue schedules and send alerts"""
    logger.info("Running overdue schedule check")

    try:
        async with async_session_maker() as db:
            now = datetime.now(timezone.utc)
            today = now.date()
            yesterday = today - timedelta(days=1)

            # Get all enabled schedules with notifications enabled
            result = await db.execute(
                select(Schedule).where(
                    and_(
                        Schedule.enabled == True,
                        Schedule.notifications_enabled == True
                    )
                )
            )
            schedules = result.scalars().all()

            logger.info(f"Checking {len(schedules)} schedules for overdue items")

            for schedule in schedules:
                try:
                    # Check if yesterday's occurrence was missed and notification not sent yet
                    # Query for MISSED status with overdue_notification_sent = False
                    # This allows retry if notification failed previously
                    completion_result = await db.execute(
                        select(ScheduleCompletion).where(
                            and_(
                                ScheduleCompletion.schedule_id == schedule.id,
                                ScheduleCompletion.scheduled_date == yesterday,
                                or_(
                                    ScheduleCompletion.status == CompletionStatus.PENDING,
                                    and_(
                                        ScheduleCompletion.status == CompletionStatus.MISSED,
                                        ScheduleCompletion.overdue_notification_sent == False
                                    )
                                )
                            )
                        )
                    )
                    completion = completion_result.scalars().first()

                    if completion:
                        # Mark as MISSED if still pending
                        if completion.status == CompletionStatus.PENDING:
                            completion.status = CompletionStatus.MISSED
                            await db.commit()

                        # Get reptile
                        reptile = await db.get(Reptile, schedule.reptile_id)
                        if not reptile:
                            continue

                        # Get schedule's selected notification channels
                        await db.refresh(schedule, ["notification_channels"])

                        if not schedule.notification_channels:
                            logger.debug(f"No channels selected for schedule {schedule.id}, skipping overdue alert")
                            continue

                        # Track if any notification succeeded
                        any_notification_sent = False

                        # Send overdue alert to each selected channel
                        for channel in schedule.notification_channels:
                            # Channel must be enabled
                            if not channel.enabled:
                                continue

                            # Get the channel owner's notification settings and user
                            notif_settings = await db.get(NotificationSettings, channel.notification_settings_id)
                            if not notif_settings:
                                continue

                            # Check if owner has overdue alerts enabled
                            if not notif_settings.notify_overdue_alerts:
                                continue

                            # Check quiet hours (overdue alerts are not critical)
                            if is_within_quiet_hours(notif_settings, NotificationType.OVERDUE_ALERT, now):
                                logger.debug(f"Skipping overdue alert for user {notif_settings.user_id} - within quiet hours")
                                continue

                            # Get the user
                            user = await db.get(User, notif_settings.user_id)
                            if not user:
                                continue

                            # Check if user has access to this reptile
                            from app.permissions import check_reptile_access
                            try:
                                await check_reptile_access(db, user, reptile.id)
                            except HTTPException:
                                # User lacks access (403) or reptile not found (404) - skip notification
                                continue

                            # Send the overdue alert and track success
                            success = await send_overdue_alert(
                                db=db,
                                reptile=reptile,
                                schedule=schedule,
                                missed_date=yesterday,
                                user=user,
                                webhook_url=channel.webhook_url,
                                webhook_type=channel.webhook_type,
                                config=channel.config
                            )

                            if success:
                                any_notification_sent = True
                                logger.info(
                                    f"Sent overdue alert for schedule {schedule.id} "
                                    f"for reptile {reptile.name} to user {user.email} via channel '{channel.name}'"
                                )
                            else:
                                logger.warning(
                                    f"Failed to send overdue alert for schedule {schedule.id} "
                                    f"to user {user.email} via channel '{channel.name}'"
                                )

                        # After trying all channels, mark notification as sent if any succeeded
                        # This prevents retrying on next check if at least one notification got through
                        if any_notification_sent:
                            completion.overdue_notification_sent = True
                            await db.commit()
                            logger.info(
                                f"Marked overdue notification as sent for completion {completion.id} "
                                f"(schedule {schedule.id}, date {yesterday})"
                            )

                except Exception as e:
                    logger.error(f"Error processing schedule {schedule.id}: {e}", exc_info=True)
                    continue

    except Exception as e:
        logger.error(f"Error in check_overdue_schedules: {e}", exc_info=True)
