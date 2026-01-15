#!/bin/bash
# Script to test OpenTelemetry tracing from nginx-otel to Tempo

echo "Testing OpenTelemetry integration..."
echo

# Generate some test traffic to create traces
echo "Generating test requests to create traces..."
for i in {1..5}; do
    curl -s -o /dev/null -w "Request $i: HTTP %{http_code} in %{time_total}s\n" http://localhost/health
    sleep 1
done

echo
echo "Checking nginx logs for trace IDs..."
docker logs nginx-otel --tail 10 2>&1 | grep trace_id || echo "No trace IDs found in logs yet"

echo
echo "To verify traces in Tempo:"
echo "1. Check if the Tempo OTLP ingress is accessible:"
echo "   kubectl get ingress -n observability tempo-otlp-grpc"
echo
echo "2. Check Tempo distributor logs for incoming traces:"
echo "   kubectl logs -n observability -l app.kubernetes.io/component=distributor --tail=50"
echo
echo "3. In Grafana:"
echo "   - Go to Explore"
echo "   - Select Tempo data source"
echo "   - Search for service: vps-nginx"
echo "   - Or search by TraceQL: {.service.name=\"vps-nginx\"}"