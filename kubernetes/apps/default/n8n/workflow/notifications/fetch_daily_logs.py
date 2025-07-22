import json
from datetime import datetime, timedelta
import os

# Read the log file
log_file = '/home/node/.n8n/alert_logs.jsonl'
alerts = []

try:
    with open(log_file, 'r') as f:
        for line in f:
            try:
                alert = json.loads(line.strip())
                alerts.append(alert)
            except json.JSONDecodeError:
                continue
except FileNotFoundError:
    print("No log file found yet")
    alerts = []

# Filter for last 24 hours
now = datetime.now()
yesterday = now - timedelta(days=1)

recent_alerts = []
for alert in alerts:
    try:
        alert_time = datetime.fromisoformat(alert['timestamp'])
        if alert_time >= yesterday:
            recent_alerts.append(alert)
    except (KeyError, ValueError):
        continue

# Return as individual items for the next node
return [{'json': alert} for alert in recent_alerts]