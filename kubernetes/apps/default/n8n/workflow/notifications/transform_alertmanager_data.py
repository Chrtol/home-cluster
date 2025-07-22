# Transform Alertmanager webhook data to standardized format
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

# Extract alert data with defensive checks
body = webhook_data.get('body', {}) if isinstance(webhook_data, dict) else {}
if not isinstance(body, dict):
    body = {}

alerts = body.get('alerts', []) if isinstance(body, dict) else []
if not isinstance(alerts, list):
    alerts = []

first_alert = alerts[0] if alerts else {}
if not isinstance(first_alert, dict):
    first_alert = {}

labels = first_alert.get('labels', {}) if isinstance(first_alert, dict) else {}
if not isinstance(labels, dict):
    labels = {}

annotations = first_alert.get('annotations', {}) if isinstance(first_alert, dict) else {}
if not isinstance(annotations, dict):
    annotations = {}

# Safe extraction for nested fields
status_obj = first_alert.get('status', {})
status = status_obj.get('state', 'unknown') if isinstance(status_obj, dict) else 'unknown'

# Transform to standardized format
transformed = {
    "source": "alertmanager",
    "alert": {
        "name": labels.get('alertname', 'Unknown') if isinstance(labels, dict) else 'Unknown',
        "severity": labels.get('severity', 'unknown') if isinstance(labels, dict) else 'unknown',
        "namespace": labels.get('namespace', 'unknown') if isinstance(labels, dict) else 'unknown',
        "summary": annotations.get('summary', '') if isinstance(annotations, dict) else '',
        "description": annotations.get('description', '') if isinstance(annotations, dict) else '',
        "status": status,
        "instance": labels.get('instance', 'unknown') if isinstance(labels, dict) else 'unknown',
        "job": labels.get('job', 'unknown') if isinstance(labels, dict) else 'unknown',
        "fingerprint": first_alert.get('fingerprint', '') if isinstance(first_alert, dict) else '',
        "labels": labels,
        "annotations": annotations
    }
}

return [{"json": transformed}]