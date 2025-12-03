import httpx
import logging
import ipaddress
from datetime import datetime, timezone, date as py_date
from typing import Optional, Dict, Any
from urllib.parse import urlparse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models import Reptile, User, Feeding, Schedule, NotificationTemplate

# Security fixes:
# - M-3: SSRF protection by validating webhook URLs
# - M-4: Better exception handling with specific errors
# - I-1: Using timezone-aware datetime

logger = logging.getLogger(__name__)

# M-3 Fix: Define blocked IP ranges for SSRF protection
BLOCKED_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),          # Private network
    ipaddress.ip_network("172.16.0.0/12"),       # Private network
    ipaddress.ip_network("192.168.0.0/16"),      # Private network
    ipaddress.ip_network("127.0.0.0/8"),         # Localhost
    ipaddress.ip_network("169.254.0.0/16"),      # Link-local / AWS metadata
    ipaddress.ip_network("::1/128"),             # IPv6 localhost
    ipaddress.ip_network("fe80::/10"),           # IPv6 link-local
    ipaddress.ip_network("fc00::/7"),            # IPv6 private
]


def validate_webhook_url(url: str) -> bool:
    """
    M-3 Fix: Validate webhook URL to prevent SSRF attacks

    Blocks:
    - Private IP addresses (RFC 1918)
    - Localhost
    - Link-local addresses
    - AWS/Cloud metadata services
    - Non-HTTP(S) protocols
    """
    try:
        parsed = urlparse(url)

        # Only allow HTTP and HTTPS protocols
        if parsed.scheme not in ["http", "https"]:
            logger.warning(f"Webhook URL rejected: Invalid protocol {parsed.scheme}")
            return False

        # Check hostname
        hostname = parsed.hostname
        if not hostname:
            logger.warning("Webhook URL rejected: No hostname")
            return False

        # Check for known dangerous hostnames
        dangerous_hosts = [
            "localhost",
            "metadata.google.internal",
            "169.254.169.254",  # AWS metadata
            "metadata.azure.internal",
        ]

        if hostname.lower() in dangerous_hosts:
            logger.warning(f"Webhook URL rejected: Blocked hostname {hostname}")
            return False

        # Resolve hostname to IP and check if it's in blocked ranges
        try:
            import socket
            ip_str = socket.gethostbyname(hostname)
            ip = ipaddress.ip_address(ip_str)

            for blocked_range in BLOCKED_IP_RANGES:
                if ip in blocked_range:
                    logger.warning(f"Webhook URL rejected: IP {ip} in blocked range {blocked_range}")
                    return False

        except (socket.gaierror, ValueError) as e:
            logger.warning(f"Webhook URL validation failed: Could not resolve hostname {hostname}: {e}")
            return False

        logger.info(f"Webhook URL validated successfully: {url}")
        return True

    except Exception as e:
        logger.error(f"Webhook URL validation error: {e}")
        return False


async def get_template_for_trigger(
    db: AsyncSession,
    trigger_type: str,
    user_id: Optional[int] = None,
    channel_type: Optional[str] = None
) -> Optional[NotificationTemplate]:
    """
    Get the best matching template for a trigger type.
    Prioritizes user templates over system templates.

    Args:
        db: Database session
        trigger_type: Type of trigger (schedule_reminder, overdue_alert, etc.)
        user_id: User ID for custom templates
        channel_type: Optional channel type filter

    Returns:
        NotificationTemplate or None if no template found
    """
    try:
        # First try to get user's custom template
        if user_id:
            query = select(NotificationTemplate).where(
                NotificationTemplate.user_id == user_id,
                NotificationTemplate.trigger_type == trigger_type,
                NotificationTemplate.is_active == True
            )

            if channel_type:
                query = query.where(
                    (NotificationTemplate.channel_type == channel_type) |
                    (NotificationTemplate.channel_type.is_(None))
                )

            result = await db.execute(query)
            template = result.scalars().first()

            if template:
                return template

        # Fall back to system template
        query = select(NotificationTemplate).where(
            NotificationTemplate.user_id.is_(None),
            NotificationTemplate.trigger_type == trigger_type,
            NotificationTemplate.template_type == "system",
            NotificationTemplate.is_active == True
        )

        if channel_type:
            query = query.where(
                (NotificationTemplate.channel_type == channel_type) |
                (NotificationTemplate.channel_type.is_(None))
            )

        result = await db.execute(query)
        return result.scalars().first()

    except Exception as e:
        logger.error(f"Error fetching template for trigger {trigger_type}: {e}")
        return None


def render_template(template_string: str, context: Dict[str, Any]) -> str:
    """
    Render a template string with context variables.

    Args:
        template_string: Template with {variable} placeholders
        context: Dictionary of variables to substitute

    Returns:
        Rendered string with variables substituted
    """
    try:
        # Simple variable substitution using format_map
        # Handles missing keys gracefully by leaving them unchanged
        return template_string.format_map({
            k: v if v is not None else ""
            for k, v in context.items()
        })
    except Exception as e:
        logger.error(f"Error rendering template: {e}")
        return template_string


def _create_discord_embed(context: Dict[str, Any], trigger_type: str, title: str, description: str) -> dict:
    """
    Create a rich Discord embed with structured fields.

    Args:
        context: Context dictionary with notification data
        trigger_type: Type of trigger (schedule_reminder, overdue_alert, etc.)
        title: Embed title
        description: Embed description

    Returns:
        Discord embed dict with fields
    """
    # Color codes
    color_map = {
        "schedule_reminder": 3447003,  # Blue
        "overdue_alert": 15158332,     # Red
        "feeding_logged": 3066993,     # Green
    }
    color = color_map.get(trigger_type, 5814783)  # Default to teal

    embed = {
        "title": f"{context.get('emoji', '📅')} {title}",
        "color": color,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "fields": [],
        "footer": {
            "text": "Reptile Tracker"
        }
    }

    # Build fields based on trigger type
    if trigger_type == "schedule_reminder":
        fields = [
            {"name": "Reptile", "value": context.get("reptile_name", "Unknown"), "inline": True},
            {"name": "Schedule", "value": context.get("schedule_name", "Unknown"), "inline": True},
            {"name": "Type", "value": context.get("schedule_type", "Unknown").title(), "inline": True},
        ]

        if context.get("scheduled_date"):
            fields.append({"name": "Due Date", "value": context["scheduled_date"], "inline": True})

        # Use the clean time_window_display if available, otherwise fall back to time_window
        if context.get("time_window_display"):
            fields.append({"name": "Time Window", "value": context["time_window_display"], "inline": True})
        elif context.get("time_window"):
            # Extract just the time portion without the newline prefix
            time_window = context["time_window"].replace("\nTime window: ", "").strip()
            if time_window:
                fields.append({"name": "Time Window", "value": time_window, "inline": True})

        if context.get("notes"):
            # Extract notes without the "Notes:" prefix if present
            notes = context["notes"].replace("\nNotes: ", "").strip()
            if notes:
                fields.append({"name": "Notes", "value": notes, "inline": False})

        embed["fields"] = fields

    elif trigger_type == "overdue_alert":
        embed["fields"] = [
            {"name": "Reptile", "value": context.get("reptile_name", "Unknown"), "inline": True},
            {"name": "Schedule", "value": context.get("schedule_name", "Unknown"), "inline": True},
            {"name": "Type", "value": context.get("schedule_type", "Unknown").title(), "inline": True},
            {"name": "Missed Date", "value": context.get("missed_date", "Unknown"), "inline": True},
            {"name": "Status", "value": "⚠️ Overdue", "inline": True},
        ]

    elif trigger_type == "feeding_logged":
        embed["fields"] = [
            {"name": "Reptile", "value": context.get("reptile_name", "Unknown"), "inline": True},
            {"name": "Fed By", "value": context.get("user_name", "Unknown"), "inline": True},
            {"name": "Food", "value": context.get("food_list", "Not specified"), "inline": False},
        ]

    return embed


async def send_webhook_notification(
    webhook_url: Optional[str] = None,
    webhook_type: str = "generic",
    message: str = "",
    title: Optional[str] = None,
    config: Optional[dict] = None,
    context: Optional[Dict[str, Any]] = None,
    trigger_type: Optional[str] = None,
):
    """
    Send notification via webhook or API
    M-3 Fix: Added SSRF protection
    M-4 Fix: Better error handling

    Args:
        webhook_url: For discord/generic webhooks
        webhook_type: discord, pushover, or generic
        message: Notification message
        title: Notification title
        config: For pushover: {api_key, user_key, devices, priority, retry, expire, sound}
        context: Optional context dict for rich formatting (Discord embeds with fields)
        trigger_type: Type of notification (schedule_reminder, overdue_alert, etc.)
    """

    try:
        # Set strict timeouts to prevent hanging
        timeout = httpx.Timeout(10.0, connect=5.0)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            if webhook_type == "discord":
                # M-3 Fix: Validate URL before making request
                if not webhook_url or not validate_webhook_url(webhook_url):
                    logger.error(f"Discord webhook blocked: Invalid or dangerous URL: {webhook_url}")
                    raise ValueError("Invalid webhook URL: URL is blocked for security reasons")

                # Create rich embed with fields if context is provided
                if context and trigger_type:
                    embed = _create_discord_embed(context, trigger_type, title or "Notification", message)
                else:
                    # Fallback to simple embed
                    embed = {
                        "title": title or "Reptile Tracker Notification",
                        "description": message,
                        "color": 5814783,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }

                payload = {
                    "embeds": [embed],
                }
                response = await client.post(webhook_url, json=payload)
                response.raise_for_status()
                logger.info(f"Discord notification sent successfully")

            elif webhook_type == "pushover":
                # Pushover uses API, not webhooks
                if not config:
                    raise ValueError("Pushover requires config with api_key and user_key")

                api_key = config.get("api_key")
                user_key = config.get("user_key")

                if not api_key or not user_key:
                    raise ValueError("Pushover requires api_key and user_key in config")

                # Build Pushover payload
                payload = {
                    "token": api_key,
                    "user": user_key,
                    "message": message,
                    "title": title or "Reptile Tracker",
                }

                # Optional fields
                if config.get("devices"):
                    payload["device"] = config["devices"]

                # Priority: -2 (silent), -1 (quiet), 0 (normal), 1 (high), 2 (emergency)
                priority_map = {
                    "silent": -2,
                    "quiet": -1,
                    "normal": 0,
                    "high": 1,
                    "emergency": 2
                }
                priority = config.get("priority", "normal")
                payload["priority"] = priority_map.get(priority, 0)

                # Emergency-specific fields
                if payload["priority"] == 2:
                    payload["retry"] = config.get("retry", 30)  # Min 30 seconds
                    payload["expire"] = config.get("expire", 3600)  # Max 86400 seconds

                # Optional sound
                if config.get("sound"):
                    payload["sound"] = config["sound"]

                # Send to Pushover API
                response = await client.post("https://api.pushover.net/1/messages.json", data=payload)
                response.raise_for_status()
                logger.info(f"Pushover notification sent successfully")

            else:  # generic webhook
                # M-3 Fix: Validate URL before making request
                if not webhook_url or not validate_webhook_url(webhook_url):
                    logger.error(f"Generic webhook blocked: Invalid or dangerous URL: {webhook_url}")
                    raise ValueError("Invalid webhook URL: URL is blocked for security reasons")

                payload = {
                    "message": message,
                    "title": title or "Reptile Tracker Notification",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                response = await client.post(webhook_url, json=payload)
                response.raise_for_status()
                logger.info(f"Generic webhook notification sent successfully")

    except httpx.TimeoutException:
        logger.error(f"Webhook notification timeout")
        # Don't raise - notifications are not critical
    except httpx.HTTPStatusError as e:
        logger.error(f"Webhook notification failed with HTTP {e.response.status_code}")
        # Don't raise - notifications are not critical
    except httpx.RequestError as e:
        logger.error(f"Webhook notification request error: {e}")
        # Don't raise - notifications are not critical
    except Exception as e:
        logger.error(f"Unexpected error sending webhook notification: {e}")
        # Don't raise - notifications are not critical


async def notify_feeding_due(reptile: Reptile, webhook_url: str, webhook_type: str):
    """Notify that a reptile is due for feeding"""
    message = f"🦎 **{reptile.name}** is due for feeding!"
    await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title="Feeding Reminder",
    )


async def notify_feeding_overdue(
    reptile: Reptile, days_overdue: int, webhook_url: str, webhook_type: str
):
    """Notify that a feeding is overdue"""
    message = f"⚠️ **{reptile.name}** hasn't been fed in {days_overdue} days!"
    await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title="Feeding Overdue",
    )


async def notify_feeding_logged(
    reptile: Reptile, user: User, feeding: Feeding, webhook_url: str, webhook_type: str
):
    """Notify that a feeding was logged"""
    food_names = [f.name for f in feeding.foods]
    food_list = ", ".join(food_names) if food_names else "No food specified"

    message = f"✅ **{user.name}** fed **{reptile.name}**\nFood: {food_list}"

    await send_webhook_notification(
        webhook_url=webhook_url,
        webhook_type=webhook_type,
        message=message,
        title="Feeding Logged",
    )
