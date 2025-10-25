# Plex Monitoring & Troubleshooting Guide

## Overview

This guide provides LogQL queries and troubleshooting steps for debugging Plex issues using your existing Loki + Promtail + Grafana stack.

## Quick Access

- **Grafana Dashboard**: https://grafana.cftollefsen.com/d/plex-monitoring
- **Loki Explore**: https://grafana.cftollefsen.com/explore

## Common LogQL Queries

### 1. Find Plex Application Errors

**When to use**: Users report "something went wrong" errors

```logql
{namespace="media", pod=~"plex-.*"} |~ "(?i)(error|fail|timeout|unable|cannot)"
```

**Advanced version** (with context):
```logql
{namespace="media", pod=~"plex-.*"}
  |~ "(?i)(error|fail|timeout|unable|cannot)"
  | line_format "{{.timestamp}} [{{.stream}}] {{.line}}"
```

### 2. Monitor HTTP Status Codes

**See all 4xx/5xx errors**:
```logql
{namespace="network", pod=~"external-ingress-nginx-controller.*"}
  | json
  | vhost="plex.cftollefsen.com"
  | status >= 400
  | line_format "{{.time}} [{{.status}}] {{.method}} {{.path}} - User: {{.http_user_agent}}"
```

**Count errors over time**:
```logql
sum by (status) (
  count_over_time({namespace="network", pod=~"external-ingress-nginx-controller.*"}
    | json
    | vhost="plex.cftollefsen.com"
    | status >= 400 [5m])
)
```

### 3. Track Slow Requests

**Find requests taking >2 seconds**:
```logql
{namespace="network", pod=~"external-ingress-nginx-controller.*"}
  | json
  | vhost="plex.cftollefsen.com"
  | unwrap request_time
  | request_time > 2
  | line_format "{{.time}} {{.path}} took {{.request_time}}s - {{.http_user_agent}}"
```

**Calculate percentiles**:
```logql
quantile_over_time(0.95,
  {namespace="network", pod=~"external-ingress-nginx-controller.*"}
    | json
    | vhost="plex.cftollefsen.com"
    | unwrap request_time [5m]
) by ()
```

### 4. Identify Problematic Clients

**Top user agents with errors**:
```logql
topk(10,
  sum by (http_user_agent) (
    count_over_time({namespace="network", pod=~"external-ingress-nginx-controller.*"}
      | json
      | vhost="plex.cftollefsen.com"
      | status >= 400 [1h])
  )
)
```

**Specific client troubleshooting** (replace with actual user agent):
```logql
{namespace="network", pod=~"external-ingress-nginx-controller.*"}
  | json
  | vhost="plex.cftollefsen.com"
  | http_user_agent =~ "(?i)plex.*ios"
  | status >= 400
```

### 5. Track Streaming Sessions

**Active streaming (exclude health checks)**:
```logql
{namespace="network", pod=~"external-ingress-nginx-controller.*"}
  | json
  | vhost="plex.cftollefsen.com"
  | http_user_agent !~ "(?i)(gatus|blackbox|prometheus)"
  | path =~ "/video/.*"
```

**Bandwidth tracking** (requires bytes_sent):
```logql
sum by (http_user_agent) (
  rate({namespace="network", pod=~"external-ingress-nginx-controller.*"}
    | json
    | vhost="plex.cftollefsen.com"
    | unwrap bytes_sent [5m])
)
```

### 6. Database Operations

**Check for database locks or slow queries**:
```logql
{namespace="media", pod=~"plex-.*"}
  |~ "(?i)(database|sqlite|lock|vacuum)"
  |~ "(?i)(slow|timeout|lock)"
```

### 7. Transcoding Issues

**Transcoding errors**:
```logql
{namespace="media", pod=~"plex-.*"}
  |~ "(?i)(transcode|transcoder)"
  |~ "(?i)(error|fail|crash)"
```

**Transcoding activity**:
```logql
{namespace="media", pod=~"plex-.*"}
  |~ "(?i)transcode.*started"
  | line_format "Session: {{.line}}"
```

## Troubleshooting Workflows

### Scenario 1: User Reports "Something Went Wrong"

1. **Check recent errors**:
   ```logql
   {namespace="media", pod=~"plex-.*"} |~ "(?i)error" | line_format "{{.timestamp}} {{.line}}"
   ```

2. **Check HTTP status codes** in the time range user reported:
   ```logql
   {namespace="network", pod=~"external-ingress-nginx-controller.*"}
     | json
     | vhost="plex.cftollefsen.com"
     | status >= 400
   ```

3. **Identify the client**:
   - Ask user what device/app they're using
   - Search for that user agent:
   ```logql
   {namespace="network", pod=~"external-ingress-nginx-controller.*"}
     | json
     | vhost="plex.cftollefsen.com"
     | http_user_agent =~ "(?i)keyword"
   ```

4. **Check response times** for that period:
   ```logql
   {namespace="network", pod=~"external-ingress-nginx-controller.*"}
     | json
     | vhost="plex.cftollefsen.com"
     | unwrap request_time
   ```

### Scenario 2: Infinite Loading

1. **Check for timeouts**:
   ```logql
   {namespace="network", pod=~"external-ingress-nginx-controller.*"}
     | json
     | vhost="plex.cftollefsen.com"
     | status = 504
   ```

2. **Check for slow database operations**:
   ```logql
   {namespace="media", pod=~"plex-.*"} |~ "(?i)(database|query)" |~ "(?i)(slow|timeout)"
   ```

3. **Check NFS mount issues**:
   ```bash
   kubectl exec -n media plex-<pod-name> -- df -h | grep /media
   ```

### Scenario 3: Playback Fails Mid-Stream

1. **Check transcoder crashes**:
   ```logql
   {namespace="media", pod=~"plex-.*"} |~ "(?i)(transcoder.*crash|segfault)"
   ```

2. **Check for network interruptions**:
   ```logql
   {namespace="network", pod=~"external-ingress-nginx-controller.*"}
     | json
     | vhost="plex.cftollefsen.com"
     | path =~ "/video/.*"
     | status != 200
   ```

3. **Check pod restarts**:
   ```bash
   kubectl get pods -n media -l app.kubernetes.io/name=plex
   kubectl describe pod -n media plex-<pod-name>
   ```

## Alert Rules

### High Error Rate Alert

Add to Prometheus AlertManager:

```yaml
- alert: PlexHighErrorRate
  expr: |
    sum(rate({namespace="network", pod=~"external-ingress-nginx-controller.*"}
      | json
      | vhost="plex.cftollefsen.com"
      | status >= 500 [5m])) > 0.1
  for: 5m
  annotations:
    summary: "High error rate on Plex ({{ $value }} req/s)"
    description: "Plex is experiencing 5xx errors"
```

### Slow Response Time Alert

```yaml
- alert: PlexSlowResponses
  expr: |
    quantile_over_time(0.95,
      {namespace="network", pod=~"external-ingress-nginx-controller.*"}
        | json
        | vhost="plex.cftollefsen.com"
        | unwrap request_time [5m]
    ) > 5
  for: 10m
  annotations:
    summary: "Plex response times are slow (p95: {{ $value }}s)"
    description: "95th percentile response time is over 5 seconds"
```

## Useful kubectl Commands

### Check Plex Status
```bash
kubectl get pods -n media -l app.kubernetes.io/name=plex
kubectl logs -n media -l app.kubernetes.io/name=plex --tail=100
```

### Check Resource Usage
```bash
kubectl top pod -n media -l app.kubernetes.io/name=plex
```

### Check Ingress
```bash
kubectl get ingress -n media plex
kubectl describe ingress -n media plex
```

### Check Service Endpoints
```bash
kubectl get endpoints -n media plex
```

### Test Direct Access
```bash
# From within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -v http://plex.media.svc.cluster.local:32400/identity

# From node with LoadBalancer
curl -v http://10.0.30.70:32400/identity
```

## Performance Baselines

**Good Performance**:
- p50 response time: < 100ms
- p95 response time: < 500ms
- p99 response time: < 1s
- 5xx error rate: < 0.01%

**Warning Signs**:
- p95 response time: > 2s
- 5xx error rate: > 0.1%
- Frequent 504 Gateway Timeout errors

**Critical**:
- p50 response time: > 1s
- 5xx error rate: > 1%
- Pod restarts or OOMKills

## Next Steps for Enhanced Monitoring

Once you have Option 1 (Loki) working, we can add:

### Option 2: OPNsense Exporter
- Track firewall blocks/drops
- Monitor bandwidth usage
- DNS resolution failures
- Connection tracking

### Option 3: Enhanced Alerting
- Prometheus alerts with AlertManager
- Discord/Slack/Email notifications
- Alert grouping and silencing

### Option 4: Distributed Tracing
- Tempo for request tracing
- End-to-end latency tracking
- Detailed request flow visualization
