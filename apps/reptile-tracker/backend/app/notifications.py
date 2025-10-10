import httpx
import logging
import ipaddress
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse
from app.config import settings
from app.models import Reptile, User, Feeding

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


async def send_webhook_notification(
    webhook_url: str,
    webhook_type: str,
    message: str,
    title: Optional[str] = None,
):
    """
    Send notification via webhook
    M-3 Fix: Added SSRF protection
    M-4 Fix: Better error handling
    """

    # M-3 Fix: Validate URL before making request
    if not validate_webhook_url(webhook_url):
        logger.error(f"Webhook notification blocked: Invalid or dangerous URL: {webhook_url}")
        raise ValueError("Invalid webhook URL: URL is blocked for security reasons")

    try:
        # Set strict timeouts to prevent hanging
        timeout = httpx.Timeout(10.0, connect=5.0)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            if webhook_type == "discord":
                payload = {
                    "content": message,
                    "embeds": [
                        {
                            "title": title or "Reptile Tracker Notification",
                            "description": message,
                            "color": 5814783,  # Green color
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ],
                }
                response = await client.post(webhook_url, json=payload)
                response.raise_for_status()

            elif webhook_type == "pushover":
                payload = {"message": message, "title": title or "Reptile Tracker"}
                response = await client.post(webhook_url, data=payload)
                response.raise_for_status()

            else:  # generic webhook
                payload = {
                    "message": message,
                    "title": title or "Reptile Tracker Notification",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                response = await client.post(webhook_url, json=payload)
                response.raise_for_status()

            logger.info(f"Webhook notification sent successfully to {webhook_url}")

    except httpx.TimeoutException:
        logger.error(f"Webhook notification timeout: {webhook_url}")
        # Don't raise - notifications are not critical
    except httpx.HTTPStatusError as e:
        logger.error(f"Webhook notification failed with HTTP {e.response.status_code}: {webhook_url}")
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
