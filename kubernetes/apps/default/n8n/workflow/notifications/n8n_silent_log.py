# Updated for n8n 2.x native Python (uses _items instead of _input)
import json
from datetime import datetime

# Get input data from n8n 2.x native Python
try:
    alert = _items[0]['json']

    # Parse JSON string if needed
    if isinstance(alert, str):
        try:
            alert = json.loads(alert)
        except json.JSONDecodeError:
            alert = {}

    # Process the alert data
    if isinstance(alert, dict):
        # Extract the actual alert data
        source = alert.get('source', 'unknown')
        alert_data = alert.get('alert', {})
        routing_context = alert.get('routing_context', {})
        
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'source': source,
            'alertname': alert_data.get('name', 'Unknown'),
            'severity': alert_data.get('severity', 'unknown'),
            'namespace': alert_data.get('namespace', 'unknown'),
            'summary': alert_data.get('summary', ''),
            'status': alert_data.get('status', 'unknown'),
            'instance': alert_data.get('instance', 'unknown'),
            'routes': routing_context.get('routes', []),
            'labels': alert_data.get('labels', {}),
            'annotations': alert_data.get('annotations', {})
        }
    else:
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'error': 'conversion_failed',
            'alert_type': str(type(alert)),
            'alert_value': str(alert)
        }

except Exception as e:
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'exception': str(e),
        'exception_type': str(type(e))
    }

# Return log entry (task runner can't write to /home/node/.n8n/ - different container)
return [{'json': log_entry}]