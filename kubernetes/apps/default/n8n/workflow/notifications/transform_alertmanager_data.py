# Transform Alertmanager webhook data to standardized format
webhook_data = _input.first()['json']

# Let's see exactly what we have step by step
body = webhook_data.get('body', {})
alerts = body.get('alerts', [])
first_alert = alerts[0] if alerts else {}
labels = first_alert.get('labels', {})
annotations = first_alert.get('annotations', {})

# Direct extraction test
test_name = labels.get('alertname', 'MISSING')

# Transform to standardized format
transformed = {
    "source": "alertmanager",
    "alert": {
        "name": test_name,
        "severity": labels.get('severity', 'MISSING'),
        "namespace": labels.get('namespace', 'MISSING'),
        "summary": annotations.get('summary', 'DEBUG TEST'),
        "description": annotations.get('description', ''),
        "status": first_alert.get('status', {}).get('state', 'unknown'),
        "instance": labels.get('instance', 'unknown'),
        "job": labels.get('job', 'unknown'),
        "fingerprint": first_alert.get('fingerprint', ''),
        "labels": labels,
        "annotations": annotations
    }
}

return [{"json": transformed}]