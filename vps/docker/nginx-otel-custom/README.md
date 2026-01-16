# Custom nginx with Proper OpenTelemetry Support

This custom nginx build uses the opentelemetry-cpp-contrib module which properly handles trace context propagation for service graphs.

## The Problem

The standard `nginx:alpine-otel` image doesn't properly create parent-child span relationships. It creates spans but doesn't inject its own span ID as the parent in forwarded requests, causing disconnected service graphs.

## The Solution

This build uses the opentelemetry-cpp-contrib nginx module which provides the `$opentelemetry_context_traceparent` variable containing the full W3C traceparent header with nginx's span as the parent.

## Key Differences from alpine-otel

| Feature | alpine-otel | opentelemetry-cpp-contrib |
|---------|------------|---------------------------|
| Creates spans | ✅ | ✅ |
| Forwards trace headers | ✅ (original headers) | ✅ (with nginx as parent) |
| `$otel_trace_id` | ✅ | ❌ |
| `$otel_span_id` | ✅ | ❌ |
| `$opentelemetry_context_traceparent` | ❌ | ✅ |
| `$opentelemetry_trace_id` | ❌ | ✅ |
| `$opentelemetry_span_id` | ❌ | ✅ |
| Proper parent-child relationships | ❌ | ✅ |

## How It Works

1. nginx receives a request (with or without traceparent header)
2. nginx creates its own span with `opentelemetry on`
3. When proxying, nginx uses `$opentelemetry_context_traceparent` which contains:
   - The same trace ID
   - nginx's span ID as the parent ID
   - Proper flags
4. Downstream services receive the header and create child spans
5. Service graph shows: `user → vps-nginx → external-ingress → app`

## Configuration

The key configuration line that makes it work:

```nginx
# This variable contains the full W3C header with nginx's span as parent
proxy_set_header traceparent $opentelemetry_context_traceparent;
```

## Deployment

1. Build the image:
```bash
docker-compose build
```

2. Copy your SSL certificates:
```bash
cp /path/to/fullchain.pem ./ssl/
cp /path/to/privkey.pem ./ssl/
```

3. Update environment variables in docker-compose.yml:
```yaml
DOMAIN: your-domain.com
```

4. Run:
```bash
docker-compose up -d
```

## Testing

After deployment, check:

1. **Trace Waterfall**: In Grafana, go to Explore → Traces → Select a trace
   - Top span should be `vps-nginx`
   - It should have a child span from `external-ingress-nginx`
   - That should have a child span from your application

2. **Service Graph**: Should show proper flow:
   ```
   user → vps-nginx → external-ingress-nginx → reptile-tracker
   ```

## Troubleshooting

If spans are still disconnected:
1. Check nginx logs for the trace ID
2. Verify the traceparent header is being sent (add debug header)
3. Ensure downstream services are configured to trust incoming spans
4. Check clock synchronization between services