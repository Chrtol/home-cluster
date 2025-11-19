# Transform Proxmox webhook data to standardized format

webhook_data = _input.first()['json']

# Convert JavaScript proxy objects to Python dictionaries if needed
if hasattr(webhook_data, 'to_py'):
    webhook_data = webhook_data.to_py()

# If webhook_data is a string, try to parse it as JSON
if isinstance(webhook_data, str):
    try:
        import json
        webhook_data = json.loads(webhook_data)
    except json.JSONDecodeError:
        webhook_data = {}

# Ensure webhook_data is a dict
if not isinstance(webhook_data, dict):
    webhook_data = {}

# Extract Proxmox data (handle n8n body wrapper)
proxmox_data = webhook_data.get('body', webhook_data)
if not isinstance(proxmox_data, dict):
    proxmox_data = {}

# Extract Proxmox fields
event_type = proxmox_data.get('type', proxmox_data.get('event', 'unknown'))
severity = proxmox_data.get('severity', 'info')
message = proxmox_data.get('message', proxmox_data.get('text', 'No message provided'))
hostname = proxmox_data.get('hostname', proxmox_data.get('node', 'unknown'))
timestamp = proxmox_data.get('timestamp', '')

# Map Proxmox severity to standardized severity
severity_map = {
    'info': 'info',
    'notice': 'info',
    'warning': 'warning',
    'error': 'critical',
    'critical': 'critical'
}
normalized_severity = severity_map.get(severity.lower(), 'info')

# Determine status based on severity
status = 'firing' if normalized_severity in ['warning', 'critical'] else 'resolved'

# Transform to standardized format
transformed = {
    "source": "proxmox",
    "alert": {
        "name": event_type,
        "severity": normalized_severity,
        "namespace": "proxmox",
        "summary": f"Proxmox {event_type}: {message}",
        "description": message,
        "status": status,
        "service_name": hostname,
        "instance": hostname,
        "timestamp": timestamp,
        # Keep original Proxmox data for debugging
        "proxmox_data": proxmox_data
    },
    "labels": {
        "hostname": hostname,
        "event_type": event_type,
        "severity": severity
    }
}

return [{"json": transformed}]
