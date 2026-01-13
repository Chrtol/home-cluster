# Tempo Tracing Configuration Guide

## Overview
Tempo is now configured to collect traces from your applications. Here's how to enable tracing for various applications in your cluster.

## Access Traces in Grafana
1. Navigate to Grafana at `https://grafana.${SECRET_DOMAIN}`
2. Go to Explore → Select "Tempo" datasource
3. Search for traces by:
   - Service name
   - Trace ID
   - Duration
   - HTTP status code

## Bucket Creation for Tempo
The S3 bucket `tempo-traces` is **fully automated**:

1. **Garage deployment** automatically creates the `garage-admin` secret on first run
2. **s3-bucket component** (included in Tempo) uses that secret to:
   - Create the `tempo-traces` bucket
   - Generate Tempo-specific access credentials
   - Store them in the `tempo-s3-credentials` secret
   - Configure proper permissions

No manual steps required - everything is GitOps automated!

## Application Configuration Examples

### Immich
```yaml
# In your Immich HelmRelease, add:
env:
  IMMICH_TELEMETRY_ENABLED: true
  OTEL_EXPORTER_OTLP_ENDPOINT: http://tempo.observability.svc.cluster.local:4317
  OTEL_SERVICE_NAME: immich
```

### Authentik
```yaml
# In your Authentik HelmRelease, add:
env:
  AUTHENTIK_TRACING__ENABLED: true
  AUTHENTIK_TRACING__ENDPOINT: http://tempo.observability.svc.cluster.local:4317
  AUTHENTIK_TRACING__SAMPLE_RATE: 0.5
```

### n8n
```yaml
# In your n8n HelmRelease, add:
env:
  N8N_DIAGNOSTICS_ENABLED: true
  N8N_TELEMETRY_ENABLED: true
  OTEL_TRACES_EXPORTER: otlp
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: http://tempo.observability.svc.cluster.local:4317
  OTEL_SERVICE_NAME: n8n
```

### Generic Applications (.NET like Sonarr/Radarr)
For .NET applications, you can use automatic instrumentation:

```yaml
# Add to your deployment:
podAnnotations:
  instrumentation.opentelemetry.io/inject-dotnet: "true"
env:
  OTEL_EXPORTER_OTLP_ENDPOINT: http://tempo.observability.svc.cluster.local:4317
  OTEL_SERVICE_NAME: sonarr  # Change to app name
  OTEL_TRACES_SAMPLER: traceidratio
  OTEL_TRACES_SAMPLER_ARG: "0.5"  # Sample 50% of traces
```

### Node.js Applications
```yaml
env:
  NODE_OPTIONS: "--require @opentelemetry/auto-instrumentations-node/register"
  OTEL_EXPORTER_OTLP_ENDPOINT: http://tempo.observability.svc.cluster.local:4317
  OTEL_SERVICE_NAME: your-app-name
  OTEL_TRACES_SAMPLER_RATIO: "0.5"
```

### Python Applications
```yaml
env:
  OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED: true
  OTEL_EXPORTER_OTLP_ENDPOINT: http://tempo.observability.svc.cluster.local:4317
  OTEL_SERVICE_NAME: your-app-name
  OTEL_TRACES_SAMPLER: traceidratio
  OTEL_TRACES_SAMPLER_ARG: "0.5"
```

## Nginx Ingress Tracing
Both internal and external nginx ingress controllers are configured to send traces to Tempo. They will automatically trace all incoming requests with a 50% sampling rate.

## Cilium Network Tracing
To enable Cilium Hubble tracing:

```yaml
# In your Cilium configuration:
hubble:
  enabled: true
  metrics:
    enabled: true
    enableOpenTelemetry: true
  export:
    otlp:
      enabled: true
      endpoint: tempo.observability.svc.cluster.local:4317
```

## Viewing Traces

### Service Map
1. Go to Grafana → Explore
2. Select Tempo datasource
3. Click "Service Graph" to see service dependencies

### Trace to Logs Correlation
When viewing a trace:
1. Click on a span
2. Click "Logs for this span"
3. Grafana will show related logs from Loki

### Trace to Metrics Correlation
1. Click on a span
2. Click "Related metrics"
3. View Prometheus metrics for that time period

## Sampling Strategies

### Development/Testing
- Use 100% sampling (1.0) to capture all traces
- Useful for debugging

### Production
- Use 10-50% sampling (0.1 - 0.5) to reduce storage
- Critical services: 50% (0.5)
- High-volume services: 10% (0.1)
- Background jobs: 1% (0.01)

## Troubleshooting

### No traces showing up
1. Check Tempo is running: `kubectl get pods -n observability | grep tempo`
2. Check logs: `kubectl logs -n observability tempo-0`
3. Verify S3 bucket exists and credentials are correct
4. Check app is configured with correct endpoint

### Missing spans
1. Increase sampling rate
2. Check network policies allow traffic to Tempo
3. Verify OpenTelemetry is enabled in the application

### Storage issues
1. Check Garage S3 bucket has space
2. Verify retention policy (currently 72h)
3. Check WAL disk usage on Tempo pod

## Next Steps

1. **Enable tracing for Immich** - Already has built-in support
2. **Enable tracing for Authentik** - Add environment variables
3. **Monitor nginx ingress traces** - Already configured, will start automatically
4. **Add custom instrumentation** to your reptile-tracker app if needed
5. **Create Grafana dashboards** with trace metrics

## Useful Grafana Queries

### Find slow requests
```
{duration > 2s}
```

### Find errors
```
{status_code >= 400}
```

### Find by service
```
{service.name="immich"}
```

### Find by operation
```
{name="HTTP GET /api/v1/assets"}
```