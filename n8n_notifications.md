# N8N Smart Notification Routing System

## Overview

Transform your home lab from "alert spam" to "intelligent notifications" using N8N as a central routing engine. This system analyzes context (time, severity, service type) and delivers alerts through the most appropriate channels to the right audience.

## Current State vs Enhanced State

### Before (Current Setup)
```
Alertmanager → Pushover (all critical alerts)
Gatus → Pushover (service monitoring)
VolSync → Manual checking
Media Issues → Manual discovery
```

### After (Smart Routing)
```
Any Alert Source → N8N Intelligence → Multiple Outputs Based on Context
```

## Architecture

### Input Sources
1. **Alertmanager Webhook** → Infrastructure & application alerts
2. **Gatus Webhook** → Service availability monitoring
3. **VolSync Webhook** → Backup status alerts
4. **Tautulli Webhook** → Media server issues
5. **Home Assistant Webhook** → Physical world alerts

### Context Analysis Engine
N8N workflow that analyzes each alert using:
- **Time context**: Day/night/weekend scheduling
- **Severity levels**: Critical/warning/info prioritization
- **Service categories**: Infrastructure/media/personal apps
- **Audience impact**: Personal/family/system-wide
- **Historical patterns**: Frequency and trends

### Output Channels

#### Personal Alerts (Admin Only)
- **Pushover High Priority**: Critical infrastructure failures
- **Email**: Weekly summaries, detailed logs
- **Discord DM**: Development and debugging information

#### Family Notifications
- **Discord Family Channel**: Media service issues, planned maintenance
- **Home Assistant Announcements**: Voice/display notifications
- **Shared Calendar**: Maintenance windows and outages

#### Silent Logging
- **Structured logs**: For trending and analysis
- **Database storage**: Alert history and metrics
- **Dashboard updates**: Real-time status boards

## Smart Routing Logic

### Example Routing Rules

```javascript
// Time-based routing
const now = new Date();
const isNightTime = now.getHours() >= 22 || now.getHours() <= 7;
const isWeekend = [0, 6].includes(now.getDay());

// Alert categorization
const isHighSeverity = alert.severity === 'critical';
const isMediaRelated = alert.namespace === 'media';
const isInfrastructure = ['observability', 'kube-system'].includes(alert.namespace);
const isBackupIssue = alert.alertname.includes('VolSync');

// Smart routing decisions
if (isHighSeverity && isInfrastructure) {
  return 'immediate_phone_call_and_pushover';
} else if (isMediaRelated && !isNightTime) {
  return 'discord_family_channel';
} else if (isBackupIssue && isNightTime) {
  return 'silent_log_for_morning_report';
} else if (isNightTime && !isHighSeverity) {
  return 'silent_log_only';
}
```

### Routing Scenarios

#### Scenario 1: Critical Infrastructure Failure
**Input**: Kubernetes node failure at any time
**Analysis**: 
- Severity: Critical
- Impact: All services
- Urgency: Immediate
**Output**: Phone call + Pushover critical + Discord admin channel

#### Scenario 2: Media Service Down
**Input**: Plex server offline during evening
**Analysis**:
- Severity: Medium
- Impact: Family entertainment
- Time: Prime viewing hours
**Output**: Discord family channel + Home Assistant announcement

#### Scenario 3: Backup Failure (Non-Critical)
**Input**: Single backup job fails at 3 AM
**Analysis**:
- Severity: Warning
- Impact: Data safety (but redundant)
- Time: Night hours
- Frequency: First occurrence
**Output**: Silent log + include in morning summary

#### Scenario 4: Routine Maintenance
**Input**: Planned maintenance notification
**Analysis**:
- Severity: Info
- Impact: Temporary service disruption
- Planning: Scheduled event
**Output**: Family calendar + Discord announcement + Home Assistant

## Implementation Phases

### Phase 1: Central Webhook Collector (Week 1)
**Goal**: Single endpoint to receive all alerts

**Tasks**:
1. Create N8N webhook endpoint: `/webhook/alerts`
2. Configure basic alert parsing and normalization
3. Test with Alertmanager integration
4. Implement simple pass-through routing

**Deliverables**:
- Working webhook receiver
- Basic alert data structure
- Initial routing to existing Pushover

### Phase 2: Context Intelligence Engine (Week 2)
**Goal**: Smart analysis and routing decisions

**Tasks**:
1. Implement time-based routing logic
2. Add severity-based escalation rules
3. Create service categorization system
4. Build audience targeting logic

**Deliverables**:
- Context analysis functions
- Routing decision engine
- Configurable rule system

### Phase 3: Multi-Channel Output (Week 3)
**Goal**: Diverse notification channels

**Tasks**:
1. Set up Discord webhooks for different channels
2. Configure Home Assistant integration
3. Implement email notification system
4. Create silent logging and metrics

**Deliverables**:
- Discord family and admin channels
- Home Assistant notification service
- Email summary system
- Alert metrics and trending

### Phase 4: Advanced Features (Week 4)
**Goal**: Enhanced intelligence and automation

**Tasks**:
1. Implement alert grouping and deduplication
2. Add escalation chains for unacknowledged alerts
3. Create vacation/maintenance modes
4. Build alert acknowledgment system

**Deliverables**:
- Smart alert grouping
- Escalation workflows
- Operational modes
- Interactive alert management

## Configuration Examples

### Alertmanager Integration

```yaml
# Add to AlertmanagerConfig
routes:
  - receiver: n8n-smart-routing
    matchers:
      - name: alertname
        value: ".*"
        matchType: =~

receivers:
  - name: n8n-smart-routing
    webhookConfigs:
      - url: "https://n8n-webhook.cftollefsen.com/webhook/alerts"
        httpConfig:
          followRedirects: true
        sendResolved: true
```

### N8N Webhook Configuration

```javascript
// Webhook trigger node configuration
{
  "path": "alerts",
  "httpMethod": "POST",
  "responseMode": "responseNode",
  "options": {}
}
```

### Context Analysis Function

```javascript
// Smart routing logic
function analyzeAlert(alert) {
  const context = {
    time: new Date(),
    severity: alert.labels.severity,
    namespace: alert.labels.namespace,
    alertname: alert.labels.alertname,
    status: alert.status.state
  };
  
  // Time-based factors
  context.isNightTime = context.time.getHours() >= 22 || context.time.getHours() <= 7;
  context.isWeekend = [0, 6].includes(context.time.getDay());
  context.isBusinessHours = context.time.getHours() >= 9 && context.time.getHours() <= 17;
  
  // Service categorization
  context.isInfrastructure = ['observability', 'kube-system', 'flux-system'].includes(context.namespace);
  context.isMedia = context.namespace === 'media';
  context.isPersonalApp = context.namespace === 'default';
  context.isBackupRelated = context.alertname.includes('VolSync') || context.alertname.includes('Backup');
  
  return context;
}

function determineRouting(context) {
  const routes = [];
  
  // Critical infrastructure always gets immediate attention
  if (context.severity === 'critical' && context.isInfrastructure) {
    routes.push('pushover_critical', 'discord_admin', 'phone_call');
  }
  
  // Media issues during prime time notify family
  else if (context.isMedia && !context.isNightTime && context.severity !== 'info') {
    routes.push('discord_family', 'homeassistant_announce');
  }
  
  // Backup issues get logged and included in daily report
  else if (context.isBackupRelated) {
    if (context.severity === 'critical') {
      routes.push('pushover_normal', 'discord_admin');
    } else {
      routes.push('silent_log', 'daily_report_queue');
    }
  }
  
  // Night time - only critical alerts
  else if (context.isNightTime && context.severity !== 'critical') {
    routes.push('silent_log');
  }
  
  // Default routing for other alerts
  else {
    routes.push('discord_admin', 'email_queue');
  }
  
  return routes;
}
```

## Notification Channel Configurations

### Discord Webhooks

```javascript
// Family channel webhook
const familyWebhook = "https://discord.com/api/webhooks/FAMILY_WEBHOOK_ID/TOKEN";

// Admin channel webhook  
const adminWebhook = "https://discord.com/api/webhooks/ADMIN_WEBHOOK_ID/TOKEN";

// Format messages for different audiences
function formatForFamily(alert) {
  return {
    embeds: [{
      title: `🚨 ${alert.labels.alertname}`,
      description: `${alert.annotations.summary}\n\n*We're looking into this and will update you soon.*`,
      color: alert.status.state === 'firing' ? 0xff0000 : 0x00ff00,
      footer: { text: "Home Lab Status • Family Notification" }
    }]
  };
}

function formatForAdmin(alert) {
  return {
    embeds: [{
      title: `⚠️ ${alert.labels.alertname}`,
      description: alert.annotations.description || alert.annotations.summary,
      fields: [
        { name: "Namespace", value: alert.labels.namespace, inline: true },
        { name: "Severity", value: alert.labels.severity, inline: true },
        { name: "Instance", value: alert.labels.instance || "N/A", inline: true }
      ],
      color: getSeverityColor(alert.labels.severity),
      timestamp: new Date().toISOString(),
      footer: { text: "Home Lab Monitoring • Admin Alert" }
    }]
  };
}
```

### Home Assistant Integration

```javascript
// Home Assistant webhook for announcements
const haWebhook = "http://home-assistant.default.svc.cluster.local:8123/api/webhook/n8n-alerts";

function createHANotification(alert) {
  return {
    message: `Attention: ${alert.annotations.summary}`,
    title: "Home Lab Alert",
    data: {
      priority: alert.labels.severity === 'critical' ? 'high' : 'normal',
      notification_id: alert.fingerprint,
      actions: [
        {
          action: "acknowledge_alert",
          title: "Acknowledge"
        }
      ]
    }
  };
}
```

### Email Summaries

```javascript
// Daily/weekly email summary configuration
const emailConfig = {
  smtp: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "homelab@yourdomain.com", 
      pass: "app_password"
    }
  },
  templates: {
    daily: "daily-summary-template",
    weekly: "weekly-report-template",
    critical: "immediate-alert-template"
  }
};
```

## Monitoring and Metrics

### Alert Routing Metrics
- **Total alerts processed**: Count by severity, source, time
- **Routing decisions**: Distribution across channels
- **Response times**: Time to acknowledgment
- **False positives**: Alerts that were resolved quickly

### Performance Metrics
- **N8N workflow execution time**: Processing speed
- **Delivery success rates**: Per channel reliability
- **Escalation frequency**: How often alerts escalate

### Dashboard Integration
```javascript
// Prometheus metrics for monitoring the monitoring
const routingMetrics = {
  total_alerts_processed: incrementCounter('n8n_alerts_total', {route, severity}),
  routing_decisions: observeHistogram('n8n_routing_duration_seconds'),
  delivery_success: incrementCounter('n8n_delivery_success_total', {channel}),
  delivery_failure: incrementCounter('n8n_delivery_failure_total', {channel, reason})
};
```

## Testing and Validation

### Test Scenarios
1. **Critical Infrastructure Alert**: Simulate node failure
2. **Media Service Disruption**: Test Plex downtime during evening
3. **Backup Failure**: Trigger VolSync alert at night
4. **Routine Maintenance**: Planned maintenance notification
5. **False Positive**: Alert that resolves quickly

### Validation Checklist
- [ ] Webhook receives alerts correctly
- [ ] Context analysis works for all scenarios
- [ ] Routing logic matches expected behavior
- [ ] All notification channels deliver successfully
- [ ] Silent logging captures all required data
- [ ] Escalation chains work properly
- [ ] Family notifications are appropriate and clear
- [ ] Admin notifications include sufficient detail

## Operational Procedures

### Daily Operations
- **Morning review**: Check overnight alerts and silent logs
- **Evening summary**: Review family-impacting issues
- **Alert acknowledgment**: Process and close resolved alerts

### Weekly Operations  
- **Routing review**: Analyze routing decisions and adjust rules
- **Channel health**: Verify all notification channels working
- **Metrics review**: Check alert patterns and trends

### Monthly Operations
- **Rule optimization**: Update routing logic based on patterns
- **Channel cleanup**: Archive old notifications and logs
- **System updates**: Update N8N workflows and integrations

## Troubleshooting

### Common Issues
1. **Webhook not receiving alerts**: Check Alertmanager configuration
2. **Routing logic errors**: Review N8N workflow logs  
3. **Discord delivery failures**: Verify webhook URLs and permissions
4. **Home Assistant integration issues**: Check HA webhook configuration
5. **Email delivery problems**: Verify SMTP settings and authentication

### Debug Mode
```javascript
// Enable detailed logging in N8N workflows
const DEBUG = true;

if (DEBUG) {
  console.log('Alert received:', JSON.stringify(alert, null, 2));
  console.log('Context analysis:', JSON.stringify(context, null, 2));
  console.log('Routing decision:', routes);
}
```

## Future Enhancements

### Short Term (1-3 months)
- **Machine learning**: Pattern recognition for alert prediction
- **Mobile app integration**: Custom mobile notifications
- **Slack integration**: For team collaboration
- **Alert templates**: Predefined responses for common issues

### Long Term (3-6 months)
- **Auto-remediation**: Automated fixes for common problems
- **Predictive alerts**: Early warning based on trends
- **Integration with ticketing**: JIRA/ServiceNow integration
- **Advanced analytics**: Alert correlation and root cause analysis

---

## Getting Started

1. **Review current alerting setup**: Document existing Alertmanager and Pushover configuration
2. **Plan notification channels**: Set up Discord webhooks and Home Assistant integration
3. **Start with Phase 1**: Implement basic webhook collector
4. **Test incrementally**: Validate each phase before moving to the next
5. **Iterate and improve**: Adjust routing rules based on real-world usage

This system transforms your home lab from reactive alert management to proactive, intelligent notification routing that respects your time, your family's experience, and the criticality of different systems.