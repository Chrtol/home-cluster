# Plex Traffic Flow & Monitoring Guide

## Traffic Paths

### External Users (Most Common)
```
Internet
  ↓
Cloudflare Tunnel (cloudflared pod)
  ↓
nginx-ingress (external-ingress-nginx)
  ↓
Plex Service (10.0.30.70)
  ↓
Plex Pod
```

**Key Insight**: The OPNsense firewall IP 10.0.30.70 is NOT in the path for external users! Traffic is tunneled directly to the ingress controller.

### Local Network Users
```
Local Device (10.0.10.x or 10.0.20.x)
  ↓
OPNsense Firewall
  ↓
nginx-ingress (internal-ingress-nginx)
  ↓
Plex Service (10.0.30.70)
  ↓
Plex Pod
```

## Monitoring by Layer

### Layer 1: Cloudflare Tunnel (External Access Only)

**Check tunnel health:**
```promql
# Are tunnel connections active?
cloudflared_tunnel_ha_connections{namespace="network"}
# Expected: 4 (high availability)

# What's the error rate?
rate(cloudflared_tunnel_request_errors{namespace="network"}[5m])
# Expected: ~0

# How many requests are going through?
rate(cloudflared_tunnel_total_requests{namespace="network"}[5m])

# Response codes breakdown
sum by (status_code) (rate(cloudflared_tunnel_response_by_code{namespace="network"}[5m]))
```

**Grafana Dashboard**: Look for the "Cloudflare Tunnel" dashboard

**When to suspect**: External users can't connect, but local users can

### Layer 2: nginx-ingress (All Users)

**Check ingress health:**
```promql
# 5xx error rate for Plex
sum(rate(nginx_ingress_controller_requests{exported_namespace="media",ingress=~"plex.*",status=~"5.."}[5m]))
/
sum(rate(nginx_ingress_controller_requests{exported_namespace="media",ingress=~"plex.*"}[5m]))

# Request latency (P95)
histogram_quantile(0.95,
  sum(rate(nginx_ingress_controller_request_duration_seconds_bucket{exported_namespace="media",ingress=~"plex.*"}[5m]))
  by (le)
)

# Requests per second
sum(rate(nginx_ingress_controller_requests{exported_namespace="media",ingress=~"plex.*"}[5m]))

# Status code breakdown
sum by (status) (rate(nginx_ingress_controller_requests{exported_namespace="media",ingress=~"plex.*"}[5m]))
```

**Loki logs for ingress:**
```logql
# See all Plex requests through ingress
{namespace="network", pod=~"external-ingress-nginx-controller.*"}
  | json
  | vhost="plex.cftollefsen.com"
  | line_format "{{.time}} [{{.status}}] {{.method}} {{.path}} - {{.request_time}}s - {{.http_user_agent}}"

# Only errors
{namespace="network", pod=~"external-ingress-nginx-controller.*"}
  | json
  | vhost="plex.cftollefsen.com"
  | status >= 400

# Slow requests
{namespace="network", pod=~"external-ingress-nginx-controller.*"}
  | json
  | vhost="plex.cftollefsen.com"
  | unwrap request_time
  | request_time > 5
```

**When to suspect**: All users affected (both external and local)

### Layer 3: Plex Application

**Check pod health:**
```promql
# Is the pod ready?
kube_pod_status_ready{namespace="media",pod=~"plex-.*",condition="true"}
# Expected: 1

# Restart rate
rate(kube_pod_container_status_restarts_total{namespace="media",pod=~"plex-.*"}[15m])
# Expected: 0

# Memory usage percentage
container_memory_working_set_bytes{namespace="media",pod=~"plex-.*",container="plex"}
/
container_spec_memory_limit_bytes{namespace="media",pod=~"plex-.*",container="plex"}

# CPU usage
rate(container_cpu_usage_seconds_total{namespace="media",pod=~"plex-.*",container="plex"}[5m])
```

**Loki logs for Plex:**
```logql
# Application errors
{namespace="media", pod=~"plex-.*"} |~ "(?i)(error|fail|timeout|unable|cannot)"

# Transcoding activity (high CPU cause)
{namespace="media", pod=~"plex-.*"} |~ "(?i)transcode"

# Recent logs with timestamps
{namespace="media", pod=~"plex-.*"} | line_format "{{.timestamp}} {{.line}}"
```

**When to suspect**: Pod restarts, high resource usage, application-level errors

### Layer 4: Network (Local Users Only)

**OPNsense firewall metrics:**
```promql
# Firewall blocking packets on server network
rate(opnsense_firewall_in_ipv4_block_packets{opnsense_instance="gw"}[5m])

# Check if Plex IP is in ARP table
opnsense_arp_table_entries{ip="10.0.30.70",opnsense_instance="gw"}

# TCP connection states
opnsense_protocol_tcp_connection_count_by_state{opnsense_instance="gw"}
```

**When to suspect**: Only local network users affected, external users work fine

## Troubleshooting Workflow

### Symptom: "Something went wrong" or infinite loading

**Step 1: Check Cloudflare Tunnel**
```bash
kubectl logs -n network -l app.kubernetes.io/name=cloudflared --tail=100
```
Look for connection errors, high error rates, or tunnel disconnections.

**Step 2: Check nginx-ingress**
```bash
# Check recent 5xx errors
kubectl logs -n network -l app.kubernetes.io/component=controller,app.kubernetes.io/instance=external-ingress-nginx --tail=200 | grep plex | grep " 5"
```

**Step 3: Check Plex pod**
```bash
# Pod status
kubectl get pod -n media -l app.kubernetes.io/name=plex

# Recent logs
kubectl logs -n media -l app.kubernetes.io/name=plex --tail=100
```

**Step 4: Check active Prometheus alerts**
```bash
# If you have kubectl access to Prometheus
kubectl port-forward -n observability svc/prometheus-operated 9090:9090

# Then visit: http://localhost:9090/alerts
# Filter for: plex
```

### Symptom: Slow loading or buffering

**Check:**
1. **Ingress latency** - Is nginx slow to respond?
2. **Transcoding** - Is Plex CPU at 100% due to transcoding?
3. **Memory** - Is Plex running out of memory?
4. **Network** - Check Cloudflare tunnel latency

### Symptom: Can't connect at all

**Check in order:**
1. Is Cloudflare tunnel up? (`cloudflared_tunnel_ha_connections`)
2. Is nginx-ingress healthy? (`kubectl get pod -n network`)
3. Is Plex pod running? (`kubectl get pod -n media`)
4. Is the ingress configured? (`kubectl get ingress -n media plex`)

## Alert Severities

| Severity | Meaning | Example |
|----------|---------|---------|
| **critical** | Service down or severely degraded | Cloudflare tunnel down, pod not ready |
| **warning** | Degraded performance or partial outage | High error rate, high latency, reduced HA |
| **info** | Informational, investigate if users report issues | Elevated 4xx errors, high CPU |

## Quick Reference

**Most useful Grafana dashboards:**
- Plex Monitoring (custom dashboard in media namespace)
- nginx-ingress Dashboard
- Cloudflare Tunnel Dashboard
- Kubernetes / Compute Resources / Namespace (Pods) - filter to media namespace

**Most useful Prometheus alerts for Plex:**
```
PlexCloudflaredTunnelDown        - External access completely broken
PlexIngressHighErrorRate         - Users seeing errors
PlexPodNotReady                  - Plex service down
PlexIngressHighLatency           - Slow performance
```

**Fastest way to check if everything is healthy:**
```bash
# One-liner health check
kubectl get pod -n network -l app.kubernetes.io/name=cloudflared && \
kubectl get pod -n network -l app.kubernetes.io/component=controller && \
kubectl get pod -n media -l app.kubernetes.io/name=plex
```

All pods should show `Running` and `READY` should show full numbers (e.g., `1/1`).
