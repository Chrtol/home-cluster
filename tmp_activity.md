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

### ✅ Gatus → N8N Webhook Integration - FULLY WORKING! 🎉
**Root Cause Found**: Gatus uses `custom` provider type, not `webhook`

**Solution Applied**:
1. **Fixed Provider Type**: Changed from `webhook` to `custom` in all Gatus config files
2. **Updated Webhook Payload**: Fixed JSON structure to match N8N expectations:
   ```json
   {
     "endpoint_name": "[ENDPOINT_NAME]",
     "group": "[ENDPOINT_GROUP]", 
     "alert_state": "[ALERT_TRIGGERED_OR_RESOLVED]",
     "description": "[ALERT_DESCRIPTION]"
   }
   ```
3. **Updated N8N Context Analysis**: Added support for new `alert_state` field while maintaining backward compatibility

**Status**: ✅ **FULLY WORKING** - Real audiobookshelf alert received at 23:04!

**Test Results**:
- ✅ Service failure detected (audiobookshelf DOWN)
- ✅ Webhook sent to N8N after 3rd failure
- ✅ Context Analysis processed alert correctly 
- ✅ Smart routing: "Gatus service down during active hours - immediate attention"
- ✅ Discord notification delivered
- ✅ Severity: critical, Status: firing, Namespace: gatus-monitoring

## Files Modified
1. `/kubernetes/components/gatus/external/config.yaml` - Changed to custom alerts
2. `/kubernetes/components/gatus/guarded/config.yaml` - Changed to custom alerts  
3. `/kubernetes/apps/observability/gatus/app/resources/config.yaml` - Added custom provider with proper JSON payload
4. `/kubernetes/apps/default/karakeep/ks.yaml` - Removed gatus component to fix conflicts
5. `/kubernetes/apps/default/n8n/workflow/notifications/n8n_context_analysis.py` - Added alert_state support + backward compatibility
6. **N8N Silent Log node** - Fixed JSON parsing errors

## Next Steps

### Ready for Testing
1. **Commit Gatus configuration changes** to apply the `custom` provider fixes
2. **Test real Gatus alerts** - audiobookshelf is currently failing and should trigger alerts
3. **Verify N8N smart routing** - ensure Discord + Pushover notifications work correctly
4. **Monitor Gatus logs** for successful webhook delivery

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