# OPNsense API Permissions for Prometheus Exporter

## Quick Setup - Choose Your Approach

### ⚠️ Important: Diagnostics Category Includes Destructive Permissions

The **Diagnostics** top-level checkbox grants access to ALL diagnostics features, including:
- ✅ Read-only: Sessions, Statistics, Interfaces (what we need)
- ❌ Destructive: Factory Default (wipes config), Halt System (reboots firewall)

### **Approach A - Simple but Overprivileged**

Check these two boxes:
1. ✅ **Status** - All status information (read-only, safe)
2. ✅ **Diagnostics** - All diagnostics (includes destructive permissions)

⚠️ The exporter never calls destructive APIs, but the permission exists if compromised.

### **Approach B - Granular (Recommended for Production)**

Only grant read-only permissions:
1. ✅ **Status** checkbox (grants all Status.* - all read-only)
2. Manually add only these from Diagnostics:
   - `Diagnostics: Firewall: Sessions`
   - `Diagnostics: Firewall: Statistics`
   - `Diagnostics: Interfaces`

This follows **least-privilege principle** and is 100% read-only.

---

## Detailed Permissions (If you want granular control)

If you prefer to be more restrictive, select only these specific privileges:

### Required for Basic Metrics

| Category | Permission Name | What it monitors |
|----------|----------------|------------------|
| **GUI** | `Dashboard (all)` | System overview stats |
| **Status** | `Gateways` | Gateway health, latency, packet loss |
| **Status** | `Interfaces` | Interface statistics, bandwidth |
| **Status** | `System` | CPU, memory, uptime |
| **Diagnostics** | `Firewall: Sessions` | Firewall state table and session info |
| **Diagnostics** | `Firewall: Statistics` | Packet filter statistics |
| **Diagnostics** | `Interfaces` | Detailed interface diagnostics |

### Optional - For Firmware Updates

| Category | Permission Name | What it enables |
|----------|----------------|-----------------|
| **System** | `Firmware: Status` | Daily firmware update checks (cronjob) |

### Optional - For Advanced Monitoring

| Category | Permission Name | What it monitors |
|----------|----------------|------------------|
| **Status** | `Services` | Service status (DHCP, DNS, etc) |
| **Status** | `System Logs` | Access to system logs |
| **Services** | `DHCPv4` | DHCP lease information |

---

## Visual Guide - What You'll See in OPNsense

When you edit the user in **System → Access → Users**, you'll see:

```
┌─ Effective Privileges ────────────────┐
│                                        │
│ [+] Add privilege                      │
│                                        │
│ Filter: [................]             │
│                                        │
│ ☐ Diagnostics                         │
│   ☐ Firewall                          │
│     ☐ Sessions                        │ ← Check this (state table)
│     ☐ Statistics                      │ ← Check this (pf stats)
│   ☐ Interfaces                        │ ← Check this
│   ☐ Netstat                           │
│                                        │
│ ☐ GUI                                 │
│   ☐ Dashboard (all)                   │ ← Check this
│                                        │
│ ☐ Status                              │ ← OR just check this whole section
│   ☐ Gateways                          │
│   ☐ Interfaces                        │
│   ☐ Services                          │
│   ☐ System                            │
│                                        │
│ ☐ System                              │
│   ☐ Firmware                          │
│     ☐ Status                          │ ← Check for firmware updates
│                                        │
└────────────────────────────────────────┘
```

---

## Quick Setup - Step by Step

### Option A: Simple (Quick but Overprivileged)

1. Edit user → Effective Privileges
2. Check **☑ Status** (grants all Status.* permissions - read-only)
3. Check **☑ Diagnostics** (grants ALL Diagnostics.* - includes write!)
4. Save

⚠️ **Warning**: This includes permissions for:
- `Diagnostics: Factory Default` - Can wipe firewall config
- `Diagnostics: Halt System` - Can reboot/shutdown firewall

The exporter doesn't use these, but they're granted.

### Option B: Granular (Recommended - Read-Only)

1. Edit user → Effective Privileges
2. Check **☑ Status** checkbox (grants all Status.* - all read-only)
3. Click **[+]** to add only these from Diagnostics:
   - Type "sessions" in filter → Select `Diagnostics: Firewall: Sessions`
   - Type "statistics" in filter → Select `Diagnostics: Firewall: Statistics`
   - Type "interfaces" in filter → Select `Diagnostics: Interfaces`
4. **Optional**: Add these if needed:
   - Type "dashboard" in filter → Select `GUI: Dashboard (all)`
   - Type "firmware" in filter → Select `System: Firmware: Status`
5. Save

✅ **100% Read-Only** - No destructive permissions granted!

---

## Testing Permissions

After setting permissions, test with curl:

```bash
# Set your credentials
export API_KEY="your-key-from-opnsense"
export API_SECRET="your-secret-from-opnsense"
export OPNSENSE_HOST="opnsense.home.arpa"

# Test 1: Interface statistics (Status: Interfaces)
curl -k --user "$API_KEY:$API_SECRET" \
  "https://$OPNSENSE_HOST/api/diagnostics/interface/getInterfaceStatistics"

# Should return JSON with interface stats

# Test 2: Gateway status (Status: Gateways)
curl -k --user "$API_KEY:$API_SECRET" \
  "https://$OPNSENSE_HOST/api/routes/gateway/status"

# Should return JSON with gateway info

# Test 3: Firewall states (Diagnostics: Firewall)
curl -k --user "$API_KEY:$API_SECRET" \
  "https://$OPNSENSE_HOST/api/diagnostics/firewall/pf_states"

# Should return JSON with firewall states

# Test 4: System info (Status: System)
curl -k --user "$API_KEY:$API_SECRET" \
  "https://$OPNSENSE_HOST/api/diagnostics/system/system_health"

# Should return JSON with CPU/memory info

# Test 5: Firmware status (System: Firmware) - Optional
curl -k --user "$API_KEY:$API_SECRET" \
  -X POST -d '{}' \
  "https://$OPNSENSE_HOST/api/core/firmware/status"

# Should return firmware update info
```

### Expected Results

✅ **Success**: Returns JSON data
❌ **Failure**: Returns HTML with "403 Forbidden" or "Authentication failed"

If you get failures:
1. Check API key/secret are correct
2. Verify permissions are saved
3. Wait 1-2 minutes for permission changes to propagate
4. Try logging out and back into OPNsense

---

## Troubleshooting Permission Errors

### Error: "Authentication failed"
- API key or secret is wrong
- User doesn't have API access enabled
- API keys section wasn't saved

### Error: "403 Forbidden" on specific endpoints
- Missing required permission for that API endpoint
- Common fix: Enable **Status** and **Diagnostics** checkbox (top-level)

### Error: No error, but empty/null data
- Permission is correct but no data available
- Example: DHCP stats return empty if DHCP is disabled
- Check OPNsense directly to verify data exists

### Exporter logs show "unauthorized"
```bash
kubectl logs -n observability -l app.kubernetes.io/name=opnsense-exporter
```
- Verify secret exists: `kubectl get secret -n observability opnsense-exporter -o yaml`
- Check 1Password has correct field names
- Verify ExternalSecret is synced: `kubectl get externalsecret -n observability`

---

## Security Notes

**These permissions are read-only** and cannot modify firewall configuration. They only allow:
- Reading status information
- Viewing statistics
- Checking system health
- Monitoring connections

They **cannot**:
- Modify firewall rules
- Change settings
- Restart services
- Access sensitive configuration

For production use, the **granular permissions** (Option B) are recommended for least-privilege access.

---

## Reference: API Endpoints Used

The exporter calls these API endpoints:

| Endpoint | Permission Required | Metric |
|----------|---------------------|--------|
| `/api/diagnostics/interface/getInterfaceStatistics` | Status: Interfaces | Interface stats |
| `/api/routes/gateway/status` | Status: Gateways | Gateway health |
| `/api/diagnostics/firewall/pf_states` | Diagnostics: Firewall: Sessions | State table |
| `/api/diagnostics/firewall/statistics` | Diagnostics: Firewall: Statistics | Packet filter stats |
| `/api/diagnostics/system/system_health` | Status: System | CPU/Memory |
| `/api/core/firmware/status` | System: Firmware: Status | Firmware updates |

---

## After Setup

Once permissions are configured and API keys are stored in 1Password:

```bash
# Deploy the exporter
git push

# Verify it's working
kubectl get pods -n observability -l app.kubernetes.io/name=opnsense-exporter
kubectl logs -n observability -l app.kubernetes.io/name=opnsense-exporter

# Check metrics are available
kubectl port-forward -n observability svc/opnsense-exporter 8080:8080
curl http://localhost:8080/metrics | grep opnsense_up
# Should show: opnsense_up 1
```

If `opnsense_up` shows `1`, everything is working! 🎉
