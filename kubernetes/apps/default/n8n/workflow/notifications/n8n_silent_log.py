import json
from datetime import datetime
import os

# Get input data safely
try:
    input_data = _input.first()['json']

    # Parse JSON string if needed
    if isinstance(input_data, str):
        try:
            alert = json.loads(input_data)
        except json.JSONDecodeError:
            alert = {}
    else:
        alert = input_data

    # Convert JavaScript proxy objects to Python dictionaries
    if hasattr(alert, 'to_py'):
        # This is a Pyodide JavaScript object - convert it
        alert = alert.to_py()
    elif not isinstance(alert, dict):
        # Try to convert by accessing properties if possible
        try:
            alert_dict = {}
            for key in dir(alert):
                if not key.startswith('_'):
                    try:
                        value = getattr(alert, key)
                        if not callable(value):
                            alert_dict[key] = value
                    except:
                        pass
            alert = alert_dict
        except:
            alert = {}

    # Now process the alert data
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

# Write to log file
log_file = '/home/node/.n8n/alert_logs.jsonl'
os.makedirs(os.path.dirname(log_file), exist_ok=True)

with open(log_file, 'a') as f:
    f.write(json.dumps(log_entry) + '\n')

return [{'json': {'logged': True, 'timestamp': log_entry['timestamp']}}]