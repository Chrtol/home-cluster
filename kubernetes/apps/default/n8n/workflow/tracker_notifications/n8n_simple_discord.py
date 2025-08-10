# Simple Discord formatter for n8n
from datetime import datetime

# Get data from previous node
data = items[0]['json']

# Determine alert level and color
if data.get("hnr_count", 0) > 0:
    color = 16711680  # Red
    title = "🚨 Tracker HnR Warning!"
elif data.get("unread_notifications", 0) > 0:
    color = 16753920  # Orange  
    title = "📧 New Tracker Notifications"
elif data.get("status") == "error":
    color = 16711680  # Red
    title = "❌ Tracker Connection Error"
elif len(data.get("alerts", [])) > 0:
    color = 16776960  # Yellow
    title = "⚠️ Tracker Update"
else:
    color = 65280  # Green
    title = "✅ Tracker Status OK"

# Build description
description_parts = [
    f"**Status:** {data.get('status', 'unknown').upper()}",
    f"**Unread:** {data.get('unread_notifications', 0)}",
    f"**Total:** {data.get('total_notifications', 0)}",
    f"**HnR:** {data.get('hnr_count', 0)}",
    f"**Ratio:** {data.get('ratio', '0.000')}"
]

# Add alerts if any
alerts = data.get("alerts", [])
if alerts:
    first_two_alerts = []
    for i, alert in enumerate(alerts):
        if i < 2:
            first_two_alerts.append(alert)
    description_parts.append(f"**Alerts:** {', '.join(first_two_alerts)}")

# Add recent notification if available
details = data.get("notification_details", [])
if details and len(details) > 0:
    if isinstance(details[0], dict):
        recent = details[0].get("message", "")
    else:
        recent = str(details[0])  # Convert to string
    
    if recent:
        if len(recent) > 80:
            recent_short = recent[0:80] + "..."
        else:
            recent_short = recent
        description_parts.append(f"**Recent:** {recent_short}")

# Create Discord payload
discord_payload = {
    "embeds": [{
        "title": title,
        "description": "\n".join(description_parts),
        "color": color,
        "timestamp": data.get("timestamp", datetime.now().isoformat()),
        "footer": {
            "text": "Tracker Monitor"
        },
        "fields": [
            {
                "name": "Links", 
                "value": "Check your tracker notifications and profile",
                "inline": False
            }
        ]
    }]
}

# Return for Discord webhook
return [{"json": discord_payload}]