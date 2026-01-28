# Fetch daily logs - Updated for n8n 2.x native Python
# NOTE: Task runner can't access /home/node/.n8n/ (different container)
# This node now expects log data to be passed in from a previous node
# or fetched via n8n's HTTP Request/Read Binary File nodes
from datetime import datetime, timedelta

def parse_timestamp(ts_str):
    """Parse timestamp and return naive datetime (strip timezone for comparison)"""
    if not ts_str:
        return None
    # Handle 'Z' suffix (UTC)
    ts_str = ts_str.replace('Z', '+00:00')
    try:
        dt = datetime.fromisoformat(ts_str)
        # Convert to naive datetime for comparison
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt
    except ValueError:
        return None

# Get logs passed from previous node (e.g., via HTTP request to a logging service)
# If no input, return empty list
try:
    logs = _items
    alerts = [item['json'] for item in logs if 'json' in item]
except:
    alerts = []

# Filter for last 24 hours
now = datetime.now()
yesterday = now - timedelta(days=1)

recent_alerts = []
for alert in alerts:
    try:
        alert_time = parse_timestamp(alert.get('timestamp', ''))
        if alert_time and alert_time >= yesterday:
            recent_alerts.append(alert)
    except (KeyError, ValueError):
        continue

# Return as individual items for the next node
return [{'json': alert} for alert in recent_alerts] if recent_alerts else [{'json': {'message': 'No recent alerts'}}]