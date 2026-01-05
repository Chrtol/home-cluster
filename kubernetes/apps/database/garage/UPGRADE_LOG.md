# Garage v1.3.0 → v2.1.0 Upgrade Log

## Pre-Upgrade State (v1.3.0)

### Buckets:
- kan-avatars
- kan-attachments
- outline
- postgres-wal

### Access Keys:
- GK58c94601c6c0c9674bfe8b11 (postgres-backup)
- GK7547a2d0e9222f4c479d6acd (outline-key)
- GKafdb07b619e65f9b176f3865 (kan-key)

### Storage Backend:
- NFS on NAS: /mnt/truenas/cf-nas/s3/data/
- NFS on NAS: /mnt/truenas/cf-nas/s3/meta/

## Upgrade Steps

### Step 1: Upgrade to v2.0.0
Time:

```bash
# Update config for v2.0.0
kubectl apply -f configmap-v2.yaml

# Update image to v2.0.0
kubectl set image deployment/garage garage=dxflrs/garage:v2.0.0 -n database

# Monitor logs
kubectl logs -n database deployment/garage -f
```

Status:

### Step 2: Verify v2.0.0

```bash
# Check status
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml status

# Verify buckets
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml bucket list
```

Status:

### Step 3: Upgrade to v2.1.0

```bash
# Update image to v2.1.0
kubectl set image deployment/garage garage=dxflrs/garage:v2.1.0 -n database

# Monitor logs
kubectl logs -n database deployment/garage -f
```

Status:

## Post-Upgrade Verification

- [ ] All buckets accessible
- [ ] All keys working
- [ ] S3 API responding
- [ ] Applications can connect
- [ ] No data loss

## Rollback Plan

If issues occur:
1. Set image back to v1.3.0
2. Apply old configmap
3. Delete pod to force restart