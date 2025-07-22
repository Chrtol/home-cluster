from datetime import datetime

def get_routing_reason(source, severity, namespace, is_night, is_infra, is_media, is_backup, is_service_down):
    """Generate human-readable routing reason"""
    if source == 'gatus':
        if is_service_down and not is_night:
            return 'Gatus service down during active hours - immediate attention'
        elif is_service_down and is_night:
            return 'Gatus service down during night - mobile alert + logging'
        else:
            return 'Gatus service recovered'
    else:  # Alertmanager
        if severity == 'critical' and is_infra:
            return 'Critical infrastructure alert - immediate attention required'
        elif is_media and not is_night:
            return 'Media service issue during active hours'
        elif is_backup and severity != 'critical':
            return 'Backup issue - logged for review'
        elif is_night and severity != 'critical':
            return 'Non-critical alert during night hours - silent logging'
        else:
            return 'Standard alert routing'

# Get webhook data and determine source
webhook_data = _input.first()['json']

# Detect source based on data structure (more reliable)
alert = webhook_data.get('body', {})
if 'endpoint_name' in alert or 'alert_state' in alert or 'resolved' in alert or 'status' in alert:
    source = 'gatus'
elif 'labels' in alert and 'annotations' in alert:
    source = 'alertmanager'
else:
    source = 'unknown'

alert = webhook_data.get('body', {})
now = datetime.now()

print(f"Alert source: {source}")
print(f"Alert data: {alert}")

# Time context analysis
is_night_time = now.hour >= 22 or now.hour <= 7
is_weekend = now.weekday() >= 5
is_business_hours = 9 <= now.hour <= 17

# Initialize variables for both sources
severity = ''
namespace = ''
alertname = ''
is_service_down = False
service_name = ''

if source == 'gatus':
    # Gatus data structure
    alertname = alert.get('endpoint_name', alert.get('name', ''))
    service_name = alertname
    namespace = 'gatus-monitoring'
    
    # Check alert_state field (new format) or fallback to legacy fields
    if 'alert_state' in alert:
        alert_state = alert.get('alert_state', '')
        is_service_down = alert_state == 'TRIGGERED'
    elif 'resolved' in alert:
        is_service_down = not alert.get('resolved', True)
    elif 'status' in alert:
        is_service_down = alert.get('status', '').upper() == 'DOWN'
    else:
        is_service_down = False
        
    severity = 'critical' if is_service_down else 'info'

elif source == 'alertmanager':
    # Alertmanager data structure
    labels = alert.get('labels', {})
    severity = labels.get('severity', '')
    namespace = labels.get('namespace', '')
    alertname = labels.get('alertname', '')

# Alert type categorization (based on alert content, not just namespace)
is_infrastructure = namespace in ['observability', 'kube-system', 'flux-system', 'ceph-csi-rbd', 'security', 'database', 'external-secrets']
is_media = namespace == 'media' or 'plex' in alertname.lower() or 'jellyfin' in alertname.lower()
is_backup_related = namespace == 'volsync-system' or 'volsync' in alertname.lower() or 'backup' in alertname.lower()
is_network = namespace in ['network'] or any(x in alertname.lower() for x in ['network', 'dns', 'coredns', 'proxy', 'cilium', 'ingress'])

# Important alert types that should always get attention
is_disk_space = any(x in alertname.lower() for x in ['disk', 'filesystem', 'space', 'storage'])
is_certificate = any(x in alertname.lower() for x in ['cert', 'tls', 'ssl', 'certificate'])
is_node_issue = any(x in alertname.lower() for x in ['node', 'kubelet', 'container', 'pod'])
is_memory_cpu = any(x in alertname.lower() for x in ['memory', 'cpu', 'oom', 'resource'])
is_database_issue = any(x in alertname.lower() for x in ['postgres', 'redis', 'database', 'db'])
is_security_issue = any(x in alertname.lower() for x in ['auth', 'login', 'security', 'unauthorized'])

# Smart routing logic
routes = []

if source == 'gatus':
    # Gatus service monitoring logic
    if is_service_down:
        routes.append('discord_admin')
        if is_night_time:
            routes.append('pushover_critical')  # Wake up for service down at night
        else:
            routes.append('pushover_gatus')     # Normal mobile notification
    # Service recovered - just log it

elif source == 'alertmanager':
    # Alert-type based routing (more comprehensive)
    
    # Critical alerts always get full attention
    if severity == 'critical':
        routes.extend(['discord_admin', 'pushover_critical'])
    
    # Important alert types that need attention even as warnings
    elif is_disk_space and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if severity == 'critical' or not is_night_time:
            routes.append('pushover_gatus')
    
    elif is_certificate and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if not is_night_time:  # Cert issues during day
            routes.append('pushover_gatus')
    
    elif is_node_issue and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if severity == 'critical':
            routes.append('pushover_critical')
    
    elif is_memory_cpu and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if severity == 'critical':
            routes.append('pushover_critical')
    
    elif is_database_issue and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if severity == 'critical':
            routes.append('pushover_critical')
    
    elif is_security_issue and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        routes.append('pushover_gatus')  # Security always gets mobile notification
    
    # Network issues
    elif is_network and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if severity == 'critical':
            routes.append('pushover_critical')
    
    # Backup issues
    elif is_backup_related and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if severity == 'critical':
            routes.append('pushover_critical')
    
    # Infrastructure warnings during business hours
    elif is_infrastructure and severity == 'warning' and is_business_hours:
        routes.append('discord_admin')
    
    # Media services during active hours
    elif is_media and not is_night_time and severity != 'info':
        routes.append('discord_admin')
    
    # Night time: warnings go to discord, critical alerts wake you up
    elif is_night_time and severity == 'warning':
        routes.append('discord_admin')
    
    # Business hours: most warnings get discord notification
    elif severity == 'warning' and is_business_hours:
        routes.append('discord_admin')

# Always log everything for metrics and analysis
routes.append('silent_log')

# Create routing context
routing_context = {
    'time': now.isoformat(),
    'source': source,
    'is_night_time': is_night_time,
    'is_weekend': is_weekend,
    'is_business_hours': is_business_hours,
    'is_infrastructure': is_infrastructure,
    'is_media': is_media,
    'is_backup_related': is_backup_related,
    'is_network': is_network,
    'is_disk_space': is_disk_space,
    'is_certificate': is_certificate,
    'is_node_issue': is_node_issue,
    'is_memory_cpu': is_memory_cpu,
    'is_database_issue': is_database_issue,
    'is_security_issue': is_security_issue,
    'is_service_down': is_service_down,
    'routes': routes,
    'routing_reason': get_routing_reason(source, severity, namespace, is_night_time, is_infrastructure, is_media, is_backup_related, is_service_down)
}

# Create unified alert structure
if source == 'gatus':
    result = {
        'labels': {
            'alertname': alertname,
            'severity': severity,
            'namespace': namespace,
            'service_name': service_name
        },
        'annotations': {
            'summary': f"Service {service_name} is {'DOWN' if is_service_down else 'UP'}",
            'description': alert.get('description', f"Gatus monitoring detected service status change")
        },
        'status': {
            'state': 'firing' if is_service_down else 'resolved'
        },
        'fingerprint': f"gatus-{service_name}",
        'routing_context': routing_context
    }
else:
    result = {
        'labels': alert.get('labels', {}),
        'annotations': alert.get('annotations', {}),
        'status': alert.get('status', {}),
        'fingerprint': alert.get('fingerprint', ''),
        'routing_context': routing_context
    }

return [{'json': result}]