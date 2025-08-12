# Simple Discord formatter for n8n
from datetime import datetime

# Get data from previous node
data = items[0]['json']

# Determine alert level and color - prioritize new issues
if data.get("status") == "error":
    color = 16711680  # Red
    title = "❌ Tracker Connection Error"
elif data.get("new_hnrs", 0) > 0:  # Only alert for NEW HnRs
    color = 16711680  # Red
    title = "🚨 New Tracker HnR Warning!"
elif data.get("hnr_count", 0) > 0 and data.get("new_notifications", 0) > 0:
    color = 16753920  # Orange - existing HnR but new notifications
    title = "⚠️ HnR Status Update"
elif data.get("unread_notifications", 0) > 0:
    color = 16753920  # Orange  
    title = "📧 New Tracker Notifications"
elif len(data.get("alerts", [])) > 0:
    color = 16776960  # Yellow
    title = "⚠️ Tracker Update"
else:
    color = 65280  # Green
    title = "✅ Tracker Status OK"

# Build clean description with everything
description_parts = []

# Add error status only when needed
if data.get("status") == "error":
    description_parts.append(f"**Status:** {data.get('status', 'unknown').upper()}")
elif data.get('hnr_count', 0) == 0:
    description_parts.append(f"**Status:** {data.get('status', 'unknown').upper()}")

# Add stats in a compact format without code blocks
stats_line = f"**Unread:** {data.get('unread_notifications', 0)} • **Total:** {data.get('total_notifications', 0)} • **HnR:** {data.get('hnr_count', 0)} • **Ratio:** {data.get('ratio', '0.000')}"

description_parts.append(stats_line)

# Add HnR details 
hnr_details = data.get('hnr_details', [])
if hnr_details:
    description_parts.append("")  # Spacing
    for i, hnr in enumerate(hnr_details[:2]):  # Show first 2 HnRs
        if hnr.get('name'):
            short_name = hnr['name'][:50] + '...' if len(hnr['name']) > 50 else hnr['name']
            ratio_info = f"⚖️ **{hnr.get('ratio', 'N/A')}**" 
            seeded_info = f"⏱️ **{hnr.get('seeding_time', 'N/A')}**"
            description_parts.append(f"🎬 **{short_name}**")
            description_parts.append(f"{ratio_info} • {seeded_info}")
            if i < len(hnr_details[:2]) - 1:  # Add spacing between multiple HnRs
                description_parts.append("")

# Add non-HnR alerts
alerts = data.get("alerts", [])
if alerts:
    non_hnr_alerts = [alert for alert in alerts if not alert.startswith('HnR')]
    if non_hnr_alerts:
        description_parts.append("")  # Spacing
        description_parts.append(f"📢 {', '.join(non_hnr_alerts[:2])}")

# Simple fields - just links (censored for privacy)
fields = [
    {
        "name": "Links",
        "value": "[Tracker Profile](https://www.example.com/profile/user) • [HnR Page](https://www.example.com/profile/user/hnr)", 
        "inline": False
    }
]

# Create Discord payload
discord_payload = {
    "embeds": [{
        "title": title,
        "description": "\n".join(description_parts) if description_parts else None,
        "color": color,
        "timestamp": data.get("timestamp", datetime.now().isoformat()),
        "footer": {
            "text": "Tracker Monitor"
        },
        "fields": fields
    }]
}

# Return for Discord webhook
return [{"json": discord_payload}]