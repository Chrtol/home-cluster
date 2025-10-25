# Using OPNsense Metrics for Plex Troubleshooting

This guide shows how to correlate OPNsense firewall metrics with Plex issues.

## Quick Reference: Plex IP

- **Plex LoadBalancer IP**: `10.0.30.70`
- **Plex Ingress IP**: `10.0.30.60` (nginx external ingress)

## Common Troubleshooting Scenarios

### Scenario 1: Users Can't Connect to Plex

**Symptoms**: "Something went wrong" or connection timeout errors

**Check 1: Is the firewall blocking Plex traffic?**

```promql
# Check if firewall is blocking traffic to Plex
increase(opnsense_pf_blocked_total{destination="10.0.30.70"}[5m])

# Check blocks to the ingress IP
increase(opnsense_pf_blocked_total{destination="10.0.30.60"}[5m])
```

**Check 2: Gateway connectivity**

```promql
# Is the gateway up?
opnsense_gateway_status{gateway="WAN_DHCP"}

# Gateway latency (should be <50ms)
opnsense_gateway_delay_seconds * 1000

# Gateway packet loss
opnsense_gateway_loss_percent
```

**Check 3: State table exhaustion**

```promql
# State table usage
(opnsense_pf_state_count / opnsense_pf_state_limit) * 100

# If this is >90%, increase state table limits in OPNsense
```

### Scenario 2: Plex Streaming is Stuttering/Buffering

**Symptoms**: Video playback starts but buffers frequently

**Check 1: Interface bandwidth saturation**

```promql
# WAN interface bandwidth usage (bits per second)
rate(opnsense_interface_bytes_total{interface="wan"}[5m]) * 8

# LAN interface bandwidth
rate(opnsense_interface_bytes_total{interface="lan"}[5m]) * 8

# Saturation percentage (>80% is problematic)
(rate(opnsense_interface_bytes_total[5m]) * 8) / opnsense_interface_speed_bits * 100
```

**Check 2: Packet loss**

```promql
# Packets being dropped
rate(opnsense_interface_discards_total[5m])

# Interface errors
rate(opnsense_interface_errors_total[5m])
```

**Check 3: Firewall performance**

```promql
# CPU usage (should be <80%)
avg(opnsense_system_cpu_usage_percent)

# Memory usage
(opnsense_system_memory_used_bytes / opnsense_system_memory_total_bytes) * 100
```

### Scenario 3: Intermittent Connection Drops

**Symptoms**: Connection drops randomly, then recovers

**Check 1: Gateway stability**

```promql
# Gateway flapping (status changes)
changes(opnsense_gateway_status[15m])

# Packet loss spikes
opnsense_gateway_loss_percent > 1
```

**Check 2: Connection tracking issues**

```promql
# Connection rate (new connections per second)
rate(opnsense_pf_state_count[5m])

# State table churn (connections being removed)
rate(opnsense_pf_state_removals_total[5m])
```

**Check 3: DHCP lease expiration** (if using DHCP)

```promql
# DHCP lease count for Plex server subnet
opnsense_dhcp_leases_active{subnet="10.0.30.0/24"}
```

### Scenario 4: External Users Can't Access Plex

**Symptoms**: Internal users work fine, external users fail

**Check 1: WAN interface issues**

```promql
# WAN interface status (should be 1 for up)
opnsense_interface_status{interface="wan"}

# WAN errors
rate(opnsense_interface_errors_total{interface="wan"}[5m])
```

**Check 2: NAT/Port forwarding** (if applicable)

```promql
# Check if WAN is receiving traffic on Plex port (32400)
# This requires firewall log parsing - check OPNsense logs directly
```

**Check 3: Gateway routing**

```promql
# Default gateway status
opnsense_gateway_status{gateway=~"WAN.*",default="true"}
```

## Correlating with Loki Logs

Combine OPNsense metrics with Loki logs for complete picture:

### Example: Find network issues during Plex errors

1. **Find when Plex had errors** (Loki):
   ```logql
   {namespace="media", pod=~"plex-.*"} |~ "(?i)error"
   ```

2. **Check OPNsense metrics at that time** (Prometheus):
   ```promql
   # Query these metrics with the same time range:
   - opnsense_gateway_loss_percent
   - rate(opnsense_interface_errors_total[5m])
   - opnsense_pf_state_count / opnsense_pf_state_limit
   ```

### Example: Correlate slow Plex with bandwidth

1. **Find slow Plex requests** (Loki):
   ```logql
   {namespace="network", pod=~"external-ingress-nginx-controller.*"}
     | json
     | vhost="plex.cftollefsen.com"
     | unwrap request_time
     | request_time > 2
   ```

2. **Check bandwidth at that time** (Prometheus):
   ```promql
   rate(opnsense_interface_bytes_total{interface="wan"}[5m]) * 8
   ```

## Useful PromQL Queries

### Network Health Dashboard

```promql
# Gateway Status (1 = up, 0 = down)
opnsense_gateway_status

# Gateway Latency (ms)
opnsense_gateway_delay_seconds * 1000

# Gateway Packet Loss (%)
opnsense_gateway_loss_percent

# WAN Bandwidth In (Mbps)
rate(opnsense_interface_bytes_in_total{interface="wan"}[5m]) * 8 / 1000000

# WAN Bandwidth Out (Mbps)
rate(opnsense_interface_bytes_out_total{interface="wan"}[5m]) * 8 / 1000000

# State Table Usage (%)
(opnsense_pf_state_count / opnsense_pf_state_limit) * 100

# Firewall CPU (%)
avg(opnsense_system_cpu_usage_percent)

# Firewall Memory (%)
(opnsense_system_memory_used_bytes / opnsense_system_memory_total_bytes) * 100
```

### Plex-Specific Monitoring

```promql
# Traffic to Plex (bytes/sec)
rate(opnsense_pf_bytes_total{destination="10.0.30.70"}[5m])

# Blocked packets to Plex
rate(opnsense_pf_blocked_total{destination="10.0.30.70"}[5m])

# Allowed packets to Plex
rate(opnsense_pf_passed_total{destination="10.0.30.70"}[5m])

# Connection count to Plex
opnsense_pf_state_count{destination="10.0.30.70"}
```

## Alert Rules Relevant to Plex

The PrometheusRule includes these alerts:

1. **OPNsenseStateTableNearFull** - State table >80% full
   - Impact: New connections may be dropped, affecting Plex users

2. **OPNsenseGatewayHighLatency** - Latency >100ms
   - Impact: Slow Plex response times, buffering

3. **OPNsenseGatewayPacketLoss** - Packet loss >5%
   - Impact: Stuttering video, connection drops

4. **OPNsenseHighInterfaceErrors** - Interface errors >10/sec
   - Impact: Packet loss, poor streaming quality

5. **OPNsenseBlockingPlexTraffic** - Firewall blocking Plex
   - Impact: Users can't connect to Plex

6. **OPNsenseInterfaceSaturated** - Interface >90% utilized
   - Impact: Bandwidth bottleneck, buffering

## Grafana Dashboard Recommendations

### Panel 1: Plex Connectivity Health
```promql
# Combine:
- opnsense_gateway_status
- opnsense_gateway_loss_percent
- opnsense_pf_blocked_total{destination="10.0.30.70"}
```

### Panel 2: Bandwidth to Plex
```promql
rate(opnsense_pf_bytes_total{destination="10.0.30.70"}[5m]) * 8 / 1000000
```

### Panel 3: Firewall Performance
```promql
# Multi-series:
- avg(opnsense_system_cpu_usage_percent)
- (opnsense_system_memory_used_bytes / opnsense_system_memory_total_bytes) * 100
- (opnsense_pf_state_count / opnsense_pf_state_limit) * 100
```

### Panel 4: Network Errors
```promql
sum by (interface) (rate(opnsense_interface_errors_total[5m]))
```

## Common OPNsense Fixes for Plex Issues

### Issue: State table full

**Solution**: Increase state table size
1. Go to OPNsense: Firewall → Settings → Advanced
2. Increase **Firewall Maximum States**
3. Increase **Firewall Maximum Table Entries**
4. Apply changes

### Issue: Bandwidth saturation

**Solution**: QoS/Traffic shaping
1. Go to OPNsense: Firewall → Shaper
2. Create traffic shaper rules
3. Prioritize Plex traffic (port 32400)
4. Set bandwidth guarantees

### Issue: Firewall blocking Plex

**Solution**: Check firewall rules
1. Go to OPNsense: Firewall → Rules
2. Verify rules allow traffic to 10.0.30.70:32400
3. Check rule order (more specific rules first)
4. Enable logging on rules to see blocks

### Issue: High latency/packet loss

**Solution**: Check gateway configuration
1. Go to OPNsense: System → Gateways → Single
2. Verify gateway IP and monitoring IP
3. Check monitoring settings (interval, packet loss threshold)
4. Consider ISP issues if external gateway

## Next Steps

1. **Deploy the exporter**: Push changes to deploy OPNsense exporter
2. **Verify metrics**: Check Prometheus targets show opnsense-exporter
3. **Create Grafana dashboard**: Use queries above
4. **Set up alerts**: Enable PrometheusRule alerts
5. **Test correlation**: Create a test issue and verify you can see it in both Plex logs and OPNsense metrics
