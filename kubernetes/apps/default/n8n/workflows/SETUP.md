# N8N Phase 3 Multi-Channel Notifications Setup

## Prerequisites

1. **Discord Webhooks**: Create two Discord webhooks
   - Admin channel webhook for immediate technical alerts
   - Summary channel webhook for daily/weekly reports

2. **1Password**: Add these secrets to your N8N entry in 1Password:
   ```
   DISCORD_ADMIN_WEBHOOK=https://discord.com/api/webhooks/YOUR_ADMIN_WEBHOOK
   DISCORD_SUMMARY_WEBHOOK=https://discord.com/api/webhooks/YOUR_SUMMARY_WEBHOOK
   ```

## Installation Steps

### 1. Apply External Secret Configuration
The updated external secret will pull Discord and Home Assistant credentials from 1Password.

### 2. Import N8N Workflow
1. Access your N8N instance at `https://n8n.your-domain.com`
2. Go to Workflows > Import from File
3. Upload `phase3-multi-channel-notifications.json`
4. Activate the workflow

### 3. Initialize Database Schema
1. In N8N, create a new workflow with a manual trigger
2. Add a SQLite node with the contents of `alert-logging-schema.sql`
3. Execute once to create the database tables

### 4. Update Alertmanager Configuration
Update your Alertmanager to send alerts to the N8N webhook:
```yaml
route:
  receiver: n8n-smart-routing
  
receivers:
  - name: n8n-smart-routing
    webhook_configs:
      - url: "https://n8n-webhook.your-domain.com/webhook/alerts"
        send_resolved: true
```

## Routing Logic

The Python-based routing logic handles:

### Alert Categories
- **Infrastructure**: `observability`, `kube-system`, `flux-system`, `ceph-csi-rbd`
- **Media**: `media` namespace
- **Network**: `network`, `cilium-system`
- **Backup**: Alerts containing "volsync" or "backup"

### Routing Rules
1. **Critical Infrastructure** → Discord admin
2. **Network Issues** → Discord admin
3. **Media Issues (during day)** → Discord admin  
4. **Backup Critical** → Discord admin only
5. **Backup Warning/Info** → Silent logging only
6. **Night Time Non-Critical** → Silent logging only
7. **Default** → Discord admin

### Daily Summary Features
- Alert volume analysis
- Severity breakdown
- Namespace trending
- Pattern insights
- System health assessment

## Testing

### Test Alert Routing
Send a test alert to verify routing:
```bash
curl -X POST https://n8n-webhook.your-domain.com/webhook/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "labels": {
      "severity": "warning",
      "namespace": "media",
      "alertname": "TestAlert"
    },
    "annotations": {
      "summary": "This is a test alert"
    },
    "status": {
      "state": "firing"
    },
    "fingerprint": "test-123"
  }'
```

### Verify Daily Summary
The daily summary runs at 8 AM each day. To test manually:
1. Go to the N8N workflow
2. Click on "Daily Summary Trigger" 
3. Click "Execute Node" to test the summary generation

## Monitoring

Check these logs in N8N:
- **Workflow executions**: Verify alerts are being processed
- **SQLite logs**: Confirm data is being stored
- **Discord delivery**: Check webhook success rates
- **Home Assistant**: Verify notifications are received

## Customization

The Python code makes it easy to:
- **Add new routing rules**: Modify the `# Smart routing logic` section
- **Change time windows**: Adjust `is_night_time` logic
- **Add new categories**: Extend the service categorization
- **Enhance summaries**: Modify the daily summary generation logic

## Troubleshooting

### Common Issues
1. **Webhook not receiving alerts**: Check Alertmanager configuration
2. **Python code errors**: Review N8N execution logs
3. **Discord delivery fails**: Verify webhook URLs in 1Password
4. **Database errors**: Ensure SQLite schema was created properly

### Debug Mode
Add this to the top of Python nodes for debugging:
```python
print(f"Alert data: {alert}")
print(f"Routing decision: {routes}")
```