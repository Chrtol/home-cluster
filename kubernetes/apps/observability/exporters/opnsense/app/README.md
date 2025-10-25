# OPNsense Exporter

Prometheus exporter for OPNsense firewall metrics to help troubleshoot network issues affecting Plex and other services.

## Features

- System metrics (CPU, memory, uptime)
- Interface statistics (bandwidth, errors, packets)
- Gateway monitoring (status, latency, packet loss)
- Firewall state table usage
- Packet filter statistics
- DHCP leases
- Firmware status checking (daily cronjob)

## Setup

### 1. Create OPNsense API Keys

1. **Log into OPNsense** web interface (https://opnsense.home.arpa)

2. **Create a monitoring user** (recommended):
   - Navigate to: **System → Access → Users**
   - Click **+** to add new user
   - Username: `prometheus-exporter`
   - Password: (generate strong password)
   - Click **Save**

3. **Assign permissions**:
   - Edit the `prometheus-exporter` user
   - Under **Effective Privileges**, choose your approach:

   **Option A - Simple (Quick but includes write permissions):**
   - Check ☑ **Status** (all read-only)
   - Check ☑ **Diagnostics** (includes Factory Default & Halt System!)
   - Click **Save**
   - ⚠️ Grants some destructive permissions the exporter won't use

   **Option B - Granular (Recommended - 100% Read-Only):**
   - Check ☑ **Status** checkbox (all read-only status info)
   - Click **+** and add only these from Diagnostics:
     - `Diagnostics: Firewall: Sessions`
     - `Diagnostics: Firewall: Statistics`
     - `Diagnostics: Interfaces`
   - Optional: Add `System: Firmware: Status` for firmware checks
   - Click **Save**
   - ✅ Least-privilege, read-only access
   - ❌ **Do NOT add**: Factory Default or Halt System

   📖 **See [PERMISSIONS.md](./PERMISSIONS.md) for detailed visual guide**

4. **Generate API Key**:
   - Still in user edit page, scroll to **API keys** section
   - Click **+** (plus icon) to create new key
   - **IMPORTANT**: Copy both values immediately:
     - **Key**: Starts with random characters
     - **Secret**: Long random string (only shown once!)
   - Click **Save**

### 2. Store in 1Password

Add these values to your 1Password `opnsense` item:

```yaml
# Field name                   | Field value
opnsense_exporter_api_key      | <your-api-key-from-opnsense>
opnsense_exporter_api_secret   | <your-api-secret-from-opnsense>
opnsense_host                  | opnsense.home.arpa
```

The ExternalSecret will automatically pull these and create a Kubernetes secret.

### 3. Verify OPNsense API Access

Test the API manually before deploying:

```bash
# Set your credentials
export API_KEY="your-key"
export API_SECRET="your-secret"

# Test basic system info
curl -k --user "$API_KEY:$API_SECRET" \
  https://opnsense.home.arpa/api/diagnostics/interface/getInterfaceStatistics

# Test firmware status
curl -k --user "$API_KEY:$API_SECRET" \
  -X POST -d '{}' \
  https://opnsense.home.arpa/api/core/firmware/status
```

If these work, the exporter will work!

### 4. Deploy

The exporter is deployed via FluxCD:

```bash
# Commit your changes
git add kubernetes/apps/observability/exporters/opnsense/
git commit -m "feat(observability): add opnsense-exporter for network monitoring"
git push
```

FluxCD will automatically:
1. Pull API credentials from 1Password
2. Create the ExternalSecret
3. Deploy the opnsense-exporter pod
4. Create ServiceMonitor for Prometheus
5. Deploy PrometheusRules for alerting

### 5. Verify Deployment

```bash
# Check pod is running
kubectl get pods -n observability -l app.kubernetes.io/name=opnsense-exporter

# Check logs
kubectl logs -n observability -l app.kubernetes.io/name=opnsense-exporter --tail=50

# Check if metrics are being scraped
kubectl port-forward -n observability svc/opnsense-exporter 8080:8080
curl http://localhost:8080/metrics
```

### 6. Verify Prometheus Scraping

1. Open Prometheus: https://prometheus.cftollefsen.com (or internal URL)
2. Go to **Status → Targets**
3. Find `serviceMonitor/observability/opnsense-exporter-app/0`
4. Should show **State: UP**
5. Query test: `opnsense_up` should return `1`

## Available Metrics

### System Metrics
```promql
opnsense_up                              # 1 if exporter is working
opnsense_system_info                     # System information
opnsense_system_cpu_usage_percent        # CPU usage %
opnsense_system_memory_used_bytes        # Memory used
opnsense_system_memory_total_bytes       # Memory total
opnsense_system_uptime_seconds           # System uptime
```

### Interface Metrics
```promql
opnsense_interface_status                # Interface up/down (1/0)
opnsense_interface_bytes_in_total        # Bytes received
opnsense_interface_bytes_out_total       # Bytes sent
opnsense_interface_packets_in_total      # Packets received
opnsense_interface_packets_out_total     # Packets sent
opnsense_interface_errors_total          # Interface errors
opnsense_interface_discards_total        # Dropped packets
opnsense_interface_speed_bits            # Interface speed
```

### Gateway Metrics
```promql
opnsense_gateway_status                  # Gateway up/down (1/0)
opnsense_gateway_delay_seconds           # Gateway latency
opnsense_gateway_loss_percent            # Packet loss %
opnsense_gateway_stddev_seconds          # Latency standard deviation
```

### Firewall Metrics
```promql
opnsense_pf_state_count                  # Current connections
opnsense_pf_state_limit                  # Max connections
opnsense_pf_state_removals_total         # Connection removals
opnsense_pf_bytes_total                  # Bytes passed/blocked
opnsense_pf_packets_total                # Packets passed/blocked
opnsense_pf_blocked_total                # Blocked packets
opnsense_pf_passed_total                 # Passed packets
```

### DHCP Metrics
```promql
opnsense_dhcp_leases_active              # Active DHCP leases
opnsense_dhcp_pool_size                  # DHCP pool size
```

## Troubleshooting

### Exporter pod won't start

1. **Check secret exists**:
   ```bash
   kubectl get secret -n observability opnsense-exporter -o yaml
   ```

2. **Verify 1Password credentials**:
   ```bash
   kubectl get externalsecret -n observability opnsense-exporter
   kubectl describe externalsecret -n observability opnsense-exporter
   ```

3. **Check pod logs**:
   ```bash
   kubectl logs -n observability -l app.kubernetes.io/name=opnsense-exporter
   ```

### Metrics not appearing in Prometheus

1. **Check ServiceMonitor**:
   ```bash
   kubectl get servicemonitor -n observability opnsense-exporter-app
   ```

2. **Test metrics endpoint directly**:
   ```bash
   kubectl port-forward -n observability svc/opnsense-exporter 8080:8080
   curl http://localhost:8080/metrics
   ```

3. **Check Prometheus targets**:
   - Go to Prometheus UI → Status → Targets
   - Search for "opnsense"
   - Check error messages

### API authentication failures

1. **Verify API key format** in 1Password:
   - Key should be alphanumeric, ~32 characters
   - Secret should be long random string

2. **Test API manually** (see step 3 in Setup)

3. **Check OPNsense user permissions**:
   - User must have diagnostic privileges
   - API key must not be expired

4. **Check OPNsense API logs**:
   - OPNsense UI → System → Log Files → Web GUI
   - Look for authentication failures

### Firmware check cronjob failing

The cronjob runs daily to check firmware updates:

```bash
# Check cronjob
kubectl get cronjob -n observability check-firmware-update

# Check last job
kubectl get jobs -n observability | grep check-firmware

# Check job logs
kubectl logs -n observability job/check-firmware-update-<timestamp>
```

## Alerts

The following alerts are configured in [prometheusrule.yaml](./prometheusrule.yaml):

### Critical Alerts
- **OPNsenseStateTableFull**: State table >95% full
- **OPNsenseGatewayDown**: Gateway is unreachable

### Warning Alerts
- **OPNsenseStateTableNearFull**: State table >80% full
- **OPNsenseGatewayHighLatency**: Gateway latency >100ms
- **OPNsenseGatewayPacketLoss**: Gateway packet loss >5%
- **OPNsenseHighInterfaceErrors**: Interface errors >10/sec
- **OPNsenseBlockingPlexTraffic**: Firewall blocking Plex traffic
- **OPNsenseHighPacketLoss**: Interface dropping >5 packets/sec
- **OPNsenseHighCPU**: CPU usage >80%
- **OPNsenseHighMemory**: Memory usage >90%
- **OPNsenseInterfaceSaturated**: Interface bandwidth >90%
- **OPNsenseDHCPPoolLow**: DHCP pool >80% full

## Using for Plex Troubleshooting

See [PLEX_TROUBLESHOOTING.md](./PLEX_TROUBLESHOOTING.md) for detailed guide on correlating OPNsense metrics with Plex issues.

**Quick checks for Plex problems:**

```promql
# Is firewall blocking Plex?
increase(opnsense_pf_blocked_total{destination="10.0.30.70"}[5m])

# Gateway health
opnsense_gateway_status
opnsense_gateway_loss_percent

# Bandwidth saturation
(rate(opnsense_interface_bytes_total[5m]) * 8) / opnsense_interface_speed_bits * 100

# State table exhaustion
(opnsense_pf_state_count / opnsense_pf_state_limit) * 100
```

## References

- **OPNsense API Docs**: https://docs.opnsense.org/development/api.html
- **Exporter GitHub**: https://github.com/AthennaMind/opnsense-exporter
- **Prometheus Docs**: https://prometheus.io/docs/
