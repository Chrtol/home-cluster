# Ceph Monitoring Setup

This guide explains how to enable Prometheus metrics from Proxmox Ceph Manager.

## Prerequisites

- Proxmox VE with Ceph installed
- SSH access to Proxmox nodes
- Ceph cluster must be healthy

## Enable Ceph Manager Prometheus Module

SSH to any Proxmox node and run:

```bash
# Enable the Prometheus module in Ceph Manager (use ceph command directly)
ceph mgr module enable prometheus

# Verify it's enabled
ceph mgr module ls | grep prometheus

# Check overall Ceph status (use pveceph for general status)
pveceph status

# Check the Prometheus endpoint is working
curl http://localhost:9283/metrics | head -20
```

The Ceph Manager Prometheus exporter should now be accessible on port 9283 on the node running the active Ceph Manager.

## Verify Metrics Collection

After enabling the module and deploying the ServiceMonitor:

1. Wait 30-60 seconds for Prometheus to scrape
2. Check Prometheus targets:
   ```bash
   # Port-forward to Prometheus
   kubectl port-forward -n observability svc/kube-prometheus-stack-prometheus 9090:9090

   # Visit http://localhost:9090/targets
   # Look for "ceph-mgr/observability" targets
   ```

3. Query for Ceph metrics in Prometheus:
   ```promql
   ceph_health_status
   ceph_osd_up
   ceph_pg_total
   ```

## Available Ceph Metrics

The Ceph Manager Prometheus module exposes many metrics including:

- **Health**: `ceph_health_status`
- **OSDs**: `ceph_osd_up`, `ceph_osd_in`, `ceph_osd_metadata`
- **Placement Groups**: `ceph_pg_total`, `ceph_pg_active_clean`
- **Pools**: `ceph_pool_percent_used`, `ceph_pool_max_avail`
- **Performance**: `ceph_osd_op_w_latency_sum`, `ceph_osd_op_w_latency_count`

## Configured Alerts

The following Ceph alerts are configured in `prometheusrule.yaml`:

- **CephClusterUnhealthy**: Ceph health status is not OK
- **CephOSDDown**: One or more OSDs are down
- **CephPGsNotActiveClean**: Placement groups are not in active+clean state
- **CephPoolHighUtilization**: Pool usage > 50%
- **CephPoolCriticalUtilization**: Pool usage > 80%
- **CephSlowOps**: Average write latency > 1 second

## Troubleshooting

### Metrics not appearing

1. Verify Ceph Manager is running:
   ```bash
   pveceph status
   # Look for "mgr: <node>(active, ...)"
   ```

2. Check the Prometheus module status:
   ```bash
   ceph mgr services
   # Should show: "prometheus": "http://<node-ip>:9283/"

   # Or check modules directly
   ceph mgr module ls
   ```

3. Test connectivity from Kubernetes:
   ```bash
   kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
     curl -s http://10.0.30.10:9283/metrics | head -20
   ```

### Port 9283 not accessible

The Ceph Manager Prometheus endpoint only listens on the node running the active manager. Check which node that is:

```bash
# Check which node is running the active manager
ceph mgr stat

# Or use pveceph status
pveceph status | grep mgr
```

Ensure the ServiceMonitor Endpoints in `ceph-servicemonitor.yaml` include the IP of the active manager node.

## References

- [Ceph Manager Prometheus Module Documentation](https://docs.ceph.com/en/latest/mgr/prometheus/)
- [Prometheus Operator ServiceMonitor Guide](https://github.com/prometheus-operator/prometheus-operator/blob/main/Documentation/user-guides/getting-started.md)
