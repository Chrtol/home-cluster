# Transform Gatus webhook data to standardized format  
# Handles n8n wrapper format: {"body": {"endpoint_name": "...", "alert_state": "..."}}

webhook_data = _input.first()['json']

# Extract Gatus data (handle n8n body wrapper)
gatus_data = webhook_data.get('body', webhook_data)

# Extract Gatus fields
alert_name = gatus_data.get('endpoint_name', gatus_data.get('name', 'UnknownService'))
group = gatus_data.get('group', 'external')
gatus_instance = gatus_data.get('gatus_instance', 'unknown')

# Determine if service is down
is_service_down = False
if 'alert_state' in gatus_data:
    # New Gatus format with alert_state
    is_service_down = gatus_data['alert_state'] == 'TRIGGERED'
elif 'resolved' in gatus_data:
    # Legacy format with resolved field
    is_service_down = not gatus_data.get('resolved', True)
elif 'status' in gatus_data:
    # Alternative format with status
    is_service_down = gatus_data.get('status', '').upper() == 'DOWN'

# Transform to standardized format
transformed = {
    "source": "gatus",
    "alert": {
        "name": alert_name,
        "severity": "critical" if is_service_down else "info",
        "namespace": "gatus-monitoring",
        "summary": f"Service {alert_name} is {'DOWN' if is_service_down else 'UP'}",
        "description": gatus_data.get('description', f"Gatus monitoring detected service status change for {alert_name}"),
        "status": "firing" if is_service_down else "resolved",
        "service_name": alert_name,
        "group": group,
        "gatus_instance": gatus_instance,
        "is_service_down": is_service_down,
        # Keep original gatus data
        "gatus_data": gatus_data
    }
}

return [{"json": transformed}]