# Garage v1.3.0 to v2.1.0 Migration Steps

## Pre-Migration (✅ Completed)
1. ✅ Run repair: `garage repair --all-nodes --yes tables`
2. ✅ Create snapshot: `garage meta snapshot --all`
3. ✅ Document existing buckets and keys

## Migration Procedure

### Step 1: Shut down v1.3.0 completely
```bash
kubectl scale deployment garage -n database --replicas=0
```

### Step 2: Apply v2 configuration
Replace `configmap.yaml` with the v2 version that has:
- `replication_factor = 1` instead of `replication_mode = "1"`
- `consistency_mode = "consistent"`

### Step 3: Update HelmRelease to v2.0.0
```yaml
tag: v2.0.0
```

### Step 4: Start Garage v2.0.0
```bash
kubectl scale deployment garage -n database --replicas=1
```

The v2.0.0 binary will automatically migrate the database on first startup.

### Step 5: Monitor migration
```bash
kubectl logs -n database deployment/garage -f
```

Look for migration success messages.

### Step 6: Verify operation
```bash
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml status
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml bucket list
```

### Step 7: Upgrade to v2.1.0
Once v2.0.0 is stable, update to v2.1.0 (minor version, no migration needed).

## Current Status
- ✅ Rolled back to v1.3.0
- ✅ Repair completed
- ✅ Snapshot created
- ⏳ Ready to proceed with shutdown and upgrade