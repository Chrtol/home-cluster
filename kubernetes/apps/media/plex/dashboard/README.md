# Plex Monitoring Dashboard

This directory contains a Grafana dashboard for monitoring Plex using Loki logs.

## What's Included

- **plex-monitoring-dashboard.json**: Grafana dashboard with 10 panels:
  - Error rate statistics (4 stat panels)
  - HTTP status codes over time (timeseries)
  - Response time percentiles (p50, p95, p99)
  - Application error logs
  - HTTP 4xx/5xx error logs
  - Top 10 user agents (pie chart)
  - Slow requests log viewer

- **TROUBLESHOOTING.md**: Comprehensive guide with LogQL queries for debugging

## Features

### Dashboard Panels

1. **Plex Errors** - Count of application errors in selected time range
2. **HTTP 4xx/5xx Errors** - Count of failed HTTP requests
3. **Slow Requests >2s** - Count of requests taking over 2 seconds
4. **Total User Requests** - Overall traffic (excluding health checks)
5. **HTTP Status Codes Over Time** - Breakdown of 2xx, 4xx, 5xx responses
6. **Response Time Percentiles** - p50, p95, p99 latency tracking
7. **Plex Application Errors** - Real-time log viewer with filters
8. **HTTP Error Requests** - Detailed error logs with user agents
9. **Top 10 User Agents** - Which clients are accessing Plex
10. **Slow Requests** - Detailed logs of slow responses

### Auto-Refresh

Dashboard refreshes every 30 seconds by default.

## Deployment

The dashboard is automatically deployed via FluxCD when you push changes:

```bash
# Commit the changes
git add kubernetes/apps/media/plex/dashboard/
git add kubernetes/apps/media/plex/ks.yaml
git commit -m "feat(plex): add Grafana monitoring dashboard with Loki queries"
git push
```

FluxCD will:
1. Create a ConfigMap with the dashboard JSON
2. Grafana sidecar will automatically detect it (label: `grafana_dashboard: "1"`)
3. Dashboard appears in Grafana under "Media" folder

## Accessing the Dashboard

1. Navigate to Grafana: https://grafana.cftollefsen.com
2. Go to Dashboards → Media → Plex Monitoring
3. Or direct link: https://grafana.cftollefsen.com/d/plex-monitoring

## Troubleshooting

If the dashboard doesn't appear:

1. **Check ConfigMap was created**:
   ```bash
   kubectl get configmap -n media plex-grafana-dashboard -o yaml
   ```

2. **Verify label is set**:
   ```bash
   kubectl get configmap -n media plex-grafana-dashboard -o jsonpath='{.metadata.labels}'
   ```
   Should show: `{"grafana_dashboard":"1"}`

3. **Check Grafana sidecar logs**:
   ```bash
   kubectl logs -n observability deploy/grafana -c k8s-sidecar --tail=50
   ```

4. **Force reconciliation**:
   ```bash
   flux reconcile kustomization plex-dashboard -n media
   ```

5. **Restart Grafana** (if needed):
   ```bash
   kubectl rollout restart -n observability deployment/grafana
   ```

## Customization

### Modify Dashboard

1. Edit the dashboard in Grafana UI
2. Save changes
3. Export JSON: Dashboard Settings → JSON Model → Copy
4. Update `plex-monitoring-dashboard.json` with new JSON
5. Commit and push

### Change Folder

Edit annotation in [kustomization.yaml](./kustomization.yaml):

```yaml
annotations:
  grafana_folder: "Your Folder Name"
```

### Add More Queries

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for additional LogQL query examples.

## Query Performance

All queries use Loki's indexed fields for optimal performance:
- `namespace`, `pod` - Indexed labels
- `json` parser for ingress logs
- `unwrap` for metric extraction
- Time range limits prevent excessive scanning

### Tips for Fast Queries

1. Use smaller time ranges when exploring
2. Add specific filters (user agent, status code)
3. Use `| line_format` only when needed
4. Avoid regex on large fields when possible

## Integration with Alerts

To add alerting based on these queries, see the Alert Rules section in [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#alert-rules).

## Next Steps

After Option 1 is working:
- [ ] Add Prometheus alerts for high error rates
- [ ] Add OPNsense exporter (Option 2)
- [ ] Set up AlertManager notifications
- [ ] Create additional dashboards for other media apps
