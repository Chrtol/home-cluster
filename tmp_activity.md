# Backup & Notification System Debug Session

## Summary
Investigated failed backup notifications from n8n that reported 3 backup failures: audiobookshelf, karakeep, and plex-config-backup.

## Issues Found & Fixed

### ✅ Backup Issues - RESOLVED
1. **karakeep**: 
   - **Problem**: Kustomization failing with "id matched 2 resources" error
   - **Root Cause**: Conflict between gatus and volsync components creating duplicate ConfigMap
   - **Solution**: Removed gatus component, used individual gatus.yaml file instead
   - **Status**: ✅ Backup working (completed successful backup)

2. **plex-config-backup**:
   - **Status**: ✅ Already working fine

3. **audiobookshelf**:
   - **Problem**: No backup configuration, using CephFS storage (doesn't support snapshots)
   - **Current Status**: PVC converted to RBD storage, needs deployment recreation
   - **Next Steps**: Deploy audiobookshelf app to test backup functionality

### ✅ N8N Notification Workflow - RESOLVED
1. **Problem**: N8N "Silent Log" node crashing with `'str' object has no attribute 'get'`
2. **Root Cause**: JSON parsing issue - webhook data arriving as string vs dictionary
3. **Solution**: Added JSON parsing logic to handle both string and dict formats
4. **Status**: ✅ Working - test webhooks process successfully

### ✅ N8N Smart Routing Logic - RESOLVED  
1. **Problem**: Gatus alerts only getting silent logged instead of Discord/Pushover notifications
2. **Root Cause**: `is_service_down` detection only checked `resolved` field, not `status` field
3. **Solution**: Updated Context Analysis node to detect both `resolved: false` and `status: "DOWN"`
4. **Status**: ✅ Working - test alerts route to Discord + Pushover correctly

### ❌ Gatus → N8N Webhook Integration - STILL BROKEN
**Current Issue**: Gatus cannot find webhook alerting provider

**Error**: 
```
[alerting.GetAlertingProviderByAlertType] No alerting provider found for alert type webhook
[watchdog.handleAlertsToTrigger] Not sending alert of type=webhook endpoint despite being TRIGGERED
```

**What Works**:
- ✅ N8N webhook endpoint responds correctly (`/webhook/gatus`)
- ✅ Manual webhook tests work perfectly 
- ✅ N8N processes Gatus alert format correctly
- ✅ Smart routing sends Discord notifications for test alerts

**What's Broken**:
- ❌ Gatus can't find webhook provider in its configuration
- ❌ No webhook alerts sent from Gatus to N8N (despite alerts being TRIGGERED)

**Configuration Made**:
1. **Components**: Changed `gatus/external` and `gatus/guarded` from `type: pushover` to `type: webhook`
2. **Gatus Config**: Added webhook provider to `/kubernetes/apps/observability/gatus/app/resources/config.yaml`:
   ```yaml
   alerting:
     webhook:
       url: https://n8n-webhook.cftollefsen.com/webhook/gatus
       default-alert:
         description: health-check failed
         send-on-resolved: true
         failure-threshold: 3
         success-threshold: 3
   ```
3. **Endpoint Alerts**: Changed from `type: pushover` to `type: webhook`

**Current Status**:
- ConfigMap shows webhook provider configuration
- Gatus restarted multiple times
- Still reports "No alerting provider found for alert type webhook"

## Files Modified
1. `/kubernetes/components/gatus/external/config.yaml` - Changed to webhook alerts
2. `/kubernetes/components/gatus/guarded/config.yaml` - Changed to webhook alerts  
3. `/kubernetes/apps/observability/gatus/app/resources/config.yaml` - Added webhook provider
4. `/kubernetes/apps/default/karakeep/ks.yaml` - Removed gatus component to fix conflicts
5. **N8N Context Analysis node** - Fixed Gatus alert detection logic
6. **N8N Silent Log node** - Fixed JSON parsing errors

## Next Steps

### Immediate (Gatus Webhook Issue)
1. **Investigate Gatus webhook provider syntax** - current config might not match expected format
2. **Check Gatus version compatibility** - webhook provider support might be version-specific
3. **Consider alternative approaches**:
   - Use Discord provider instead of webhook
   - Use different webhook configuration structure
   - Check if webhook provider needs additional fields

### Testing
1. **Wait for real audiobookshelf alerts** once deployment recreated
2. **Verify backup restoration works** for karakeep
3. **Test notification system during different times** (day vs night routing)

### Backup Completion
1. **Fix audiobookshelf deployment** - currently has no pods despite Ready status
2. **Verify audiobookshelf backup** once app is running
3. **Test backup restoration procedures**

## Current Working State
- ✅ karakeep: Full backup + monitoring working
- ✅ plex-config-backup: Working
- ✅ N8N notification workflow: Processes webhooks correctly
- ❌ Gatus → N8N integration: Broken (webhook provider not found)
- ⚠️ audiobookshelf: Needs deployment fix, then backup testing

## Key Learnings
1. **VolSync requires RBD storage** - CephFS doesn't support snapshots
2. **Gatus + VolSync components conflict** - use individual files instead
3. **N8N workflows need robust JSON parsing** - webhook data format varies
4. **Gatus webhook provider configuration** - syntax appears to be the current blocker

## Emergency Contacts
- Backup failures: Check VolSync ReplicationSource status
- Notification failures: Check N8N workflow execution logs
- Gatus alerts: Manually test webhook endpoints to verify N8N pipeline