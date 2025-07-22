from datetime import datetime, timedelta
from collections import Counter
import json

# Get all alert logs from previous node
alerts = [item['json'] for item in _input.all()]
now = datetime.now()

# Debug: Print alert count for troubleshooting
print(f"Total alerts received: {len(alerts)}")
if alerts:
    print(f"Sample alert keys: {list(alerts[0].keys())}")

# Enhanced data extraction functions
def get_severity(alert):
    severity = alert.get('severity') or alert.get('labels', {}).get('severity', '')
    severity = str(severity).lower().strip()
    if severity in ['critical', 'error', 'high']:
        return 'critical'
    elif severity in ['warning', 'warn', 'medium']:
        return 'warning'
    elif severity in ['info', 'information', 'low']:
        return 'info'
    return 'other'

def get_namespace(alert):
    namespace = (
        alert.get('namespace') or 
        alert.get('labels', {}).get('namespace') or
        alert.get('labels', {}).get('exported_namespace') or
        alert.get('receiver', '').split('.')[-1] if '.' in str(alert.get('receiver', '')) else
        'infrastructure'
    )
    return namespace if namespace and namespace != 'unknown' else 'infrastructure'

def get_alert_name(alert):
    return alert.get('alertname') or alert.get('labels', {}).get('alertname', 'UnknownAlert')

def get_instance(alert):
    return alert.get('labels', {}).get('instance', alert.get('instance', 'unknown'))

# Categorize alerts
critical = [a for a in alerts if get_severity(a) == 'critical']
warning = [a for a in alerts if get_severity(a) == 'warning']
info = [a for a in alerts if get_severity(a) == 'info']
other = [a for a in alerts if get_severity(a) == 'other']

# Analyze patterns
namespace_counts = Counter(get_namespace(a) for a in alerts)
alert_type_counts = Counter(get_alert_name(a) for a in alerts)
instance_counts = Counter(get_instance(a) for a in alerts)

# Time-based analysis
alert_hours = Counter()
for alert in alerts:
    try:
        alert_time = datetime.fromisoformat(alert['timestamp'])
        hour = alert_time.hour
        alert_hours[hour] += 1
    except (KeyError, ValueError):
        continue

peak_hour = alert_hours.most_common(1)[0] if alert_hours else (0, 0)

# Build comprehensive summary
if len(alerts) == 0:
    summary = "🎉 **Perfect Day** - No alerts in the last 24 hours!"
    color = 65280  # Green
    
    # Create simple embed for zero alerts
    embed = {
        "title": f"🏠 Home Lab Status • {now.strftime('%A, %B %d')}",
        "description": summary,
        "color": color,
        "timestamp": now.isoformat(),
        "footer": {"text": "Monitoring • All systems quiet"}
    }
    
    return [{"json": {"embeds": [embed]}}]
else:
    # Header with overview
    total_line = f"📊 **{len(alerts)} Alerts** over 24 hours"
    severity_line = f"🔴 {len(critical)} Critical  •  🟡 {len(warning)} Warning  •  🔵 {len(info)} Info"
    if other:
        severity_line += f"  •  ⚪ {len(other)} Other"
    
    summary_parts = [total_line, severity_line, ""]
    
    # Critical issues section
    if critical:
        summary_parts.append("🚨 **Critical Issues:**")
        critical_by_type = Counter(get_alert_name(a) for a in critical)
        for alert_name, count in critical_by_type.most_common(3):
            if count > 1:
                summary_parts.append(f"• {alert_name} ({count} instances)")
            else:
                summary_parts.append(f"• {alert_name}")
        summary_parts.append("")
    
    # Activity breakdown
    summary_parts.append("📈 **Activity Breakdown:**")
    summary_parts.append(f"• Peak hour: {peak_hour[1]} alerts at {peak_hour[0]:02d}:00")
    summary_parts.append(f"• Average: {len(alerts)/24:.1f} alerts/hour")
    
    # Most active components
    if instance_counts.most_common(1)[0][1] > 1:
        top_instance = instance_counts.most_common(1)[0]
        summary_parts.append(f"• Most active: {top_instance[0]} ({top_instance[1]} alerts)")
    
    summary_parts.append("")
    
    # Top alert types
    if len(alert_type_counts) > 1:
        summary_parts.append("🔍 **Top Alert Types:**")
        for alert_name, count in alert_type_counts.most_common(4):
            percentage = (count / len(alerts)) * 100
            summary_parts.append(f"• {alert_name}: {count} ({percentage:.0f}%)")
        summary_parts.append("")
    
    # Namespace activity (only show real namespaces)
    real_namespaces = [(ns, count) for ns, count in namespace_counts.most_common() if ns != 'infrastructure']
    infra_count = namespace_counts.get('infrastructure', 0)
    
    if real_namespaces or infra_count > 0:
        summary_parts.append("🏗️ **Namespace Activity:**")
        for ns, count in real_namespaces[:4]:
            percentage = (count / len(alerts)) * 100
            summary_parts.append(f"• {ns}: {count} alerts ({percentage:.0f}%)")
        if infra_count > 0:
            infra_percentage = (infra_count / len(alerts)) * 100
            summary_parts.append(f"• Infrastructure: {infra_count} alerts ({infra_percentage:.0f}%)")
    
    summary = "\n".join(summary_parts)

# Determine color
color = 65280  # Green (default)
if len(critical) > 0:
    color = 16711680  # Red
elif len(warning) > 3:
    color = 16776960  # Yellow
elif len(alerts) > 30:
    color = 16753920  # Orange

# Create enhanced Discord embed
embed = {
    "title": f"🏠 Home Lab Status • {now.strftime('%A, %B %d')}",
    "description": summary,
    "color": color,
    "timestamp": now.isoformat(),
    "footer": {
        "text": f"Monitoring • {len(set(get_namespace(a) for a in alerts))} namespaces • {len(alert_type_counts)} alert types"
    }
}

# Add health indicator field
if len(alerts) > 0:
    if len(critical) > 0:
        health_status = "🔴 Action Required"
        health_desc = f"{len(critical)} critical alerts need immediate attention"
    elif len(warning) > 5:
        health_status = "🟡 Monitoring"
        health_desc = f"{len(warning)} warnings detected, system stable"
    elif len(alerts) > 40:
        health_status = "🟠 High Activity"
        health_desc = f"{len(alerts)} alerts today, above normal volume"
    else:
        health_status = "🟢 Stable"
        health_desc = f"{len(alerts)} routine alerts, all systems normal"
    
    embed["fields"] = [
        {
            "name": health_status,
            "value": health_desc,
            "inline": False
        }
    ]

return [{"json": {"embeds": [embed]}}]