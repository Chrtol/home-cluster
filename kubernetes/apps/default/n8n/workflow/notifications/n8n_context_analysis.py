from datetime import datetime

def get_routing_reason(source, severity, namespace, is_night, is_infra, is_media, is_backup, is_service_down, alert_name=""):
    """Generate human-readable routing reason"""
    if source == 'gatus':
        if is_service_down and not is_night:
            return 'Gatus service down during active hours - immediate attention'
        elif is_service_down and is_night:
            return 'Gatus service down during night - mobile alert + logging'
        else:
            return 'Gatus service recovered'
    elif source == 'proxmox':
        if severity == 'critical':
            return 'Proxmox critical issue - infrastructure requires immediate attention'
        elif is_backup:
            return 'Proxmox backup notification - data protection update'
        elif 'storage' in alert_name.lower() or 'disk' in alert_name.lower():
            return 'Proxmox storage alert - capacity or health concern'
        elif 'node' in alert_name.lower() or 'cluster' in alert_name.lower():
            return 'Proxmox node/cluster alert - infrastructure stability'
        elif 'replication' in alert_name.lower():
            return 'Proxmox replication alert - data sync concern'
        elif severity == 'warning':
            return 'Proxmox warning - admin attention recommended'
        else:
            return 'Proxmox notification - informational'
    else:  # Alertmanager
        if severity == 'critical':
            return 'Critical alert - immediate attention required'
        elif 'disk' in alert_name.lower() or 'filesystem' in alert_name.lower():
            return 'Disk space alert - system health concern'
        elif 'cert' in alert_name.lower() or 'tls' in alert_name.lower():
            return 'Certificate alert - security concern'
        elif 'node' in alert_name.lower() or 'kubelet' in alert_name.lower():
            return 'Node/infrastructure alert - system stability'
        elif is_backup:
            return 'Backup system alert - data protection concern'
        elif is_night and severity != 'critical':
            return 'Warning during night hours - discord notification'
        elif severity == 'warning':
            return 'Warning alert - admin attention recommended'
        else:
            return 'Standard alert routing'

# Get standardized data from transformation node
data = _input.first()['json']
now = datetime.now()

# Extract clean data
source = data.get('source', 'unknown')
alert = data.get('alert', {})

# Alert details
alertname = alert.get('name', 'UnknownAlert')
severity = alert.get('severity', 'unknown')
namespace = alert.get('namespace', 'unknown')
is_service_down = alert.get('is_service_down', False)

# Time context analysis
is_night_time = now.hour >= 22 or now.hour <= 7
is_weekend = now.weekday() >= 5
is_business_hours = 9 <= now.hour <= 17

# Service/Alert categorization
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

elif source == 'proxmox':
    # Proxmox infrastructure monitoring
    is_proxmox_backup = 'backup' in alertname.lower() or 'vzdump' in alertname.lower()
    is_proxmox_storage = 'storage' in alertname.lower() or 'disk' in alertname.lower() or 'space' in alertname.lower()
    is_proxmox_node = 'node' in alertname.lower() or 'cluster' in alertname.lower() or 'quorum' in alertname.lower()
    is_proxmox_replication = 'replication' in alertname.lower() or 'sync' in alertname.lower()
    is_proxmox_update = 'update' in alertname.lower() or 'upgrade' in alertname.lower()

    # Critical Proxmox issues
    if severity == 'critical':
        routes.extend(['discord_admin', 'pushover_critical'])

    # Storage issues are important
    elif is_proxmox_storage and severity == 'warning':
        routes.append('discord_admin')
        if not is_night_time:
            routes.append('pushover_gatus')

    # Node/cluster issues
    elif is_proxmox_node and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if severity == 'critical':
            routes.append('pushover_critical')

    # Backup failures during business hours
    elif is_proxmox_backup and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if severity == 'critical' or (is_business_hours and severity == 'warning'):
            routes.append('pushover_gatus')

    # Replication issues
    elif is_proxmox_replication and severity in ['critical', 'warning']:
        routes.append('discord_admin')
        if severity == 'critical':
            routes.append('pushover_critical')

    # Updates/info messages - discord only
    elif is_proxmox_update or severity == 'info':
        routes.append('discord_admin')

    # Any other warning
    elif severity == 'warning':
        routes.append('discord_admin')

elif source == 'alertmanager':
    # Alert-type based routing (comprehensive)

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

    # Catch-all: any other warning alerts get discord notification
    elif severity == 'warning':
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
    'routing_reason': get_routing_reason(source, severity, namespace, is_night_time, is_infrastructure, is_media, is_backup_related, is_service_down, alertname)
}

# Create final output with standardized alert data + routing context
result = {
    'source': source,  # Pass through the source field
    'labels': alert.get('labels', {}),
    'annotations': alert.get('annotations', {}),
    'status': {'state': alert.get('status', 'unknown')},
    'fingerprint': alert.get('fingerprint', ''),
    'routing_context': routing_context,
    # Include standardized alert data for easy access
    'alert': alert
}

return [{'json': result}]