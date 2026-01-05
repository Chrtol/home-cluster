# Garage v1.3.0 to v2.1.0 Migration Guide

## Current State
- **Current Version**: v1.3.0 (restored and working)
- **Data**: 2 apps + PostgreSQL backups stored in Garage
- **Storage**: NFS mounts from NAS

## Migration Steps

### Phase 1: Backup Current Data (CRITICAL)
Before starting the migration, ensure you have a backup of your data:

```bash
# 1. List current buckets and keys
export KUBECONFIG=/home/chrto/Homelab/github/chrtol/home-cluster/kubeconfig
kubectl exec -n database deployment/garage -- garage -c /etc/garage.toml bucket list
kubectl exec -n database deployment/garage -- garage -c /etc/garage.toml key list

# 2. Document these for reference
# 3. Consider backing up the NFS directories on your NAS:
#    - /mnt/truenas/cf-nas/s3/data/
#    - /mnt/truenas/cf-nas/s3/meta/
```

### Phase 2: Upgrade to v2.0.0

1. **Update ConfigMap with v2.0.0 configuration**:
   ```bash
   # Replace configmap.yaml with configmap-v2.yaml
   mv kubernetes/apps/database/garage/app/configmap.yaml kubernetes/apps/database/garage/app/configmap-v1.yaml.bak
   mv kubernetes/apps/database/garage/app/configmap-v2.yaml kubernetes/apps/database/garage/app/configmap.yaml
   ```

2. **Update HelmRelease to v2.0.0**:
   ```yaml
   # In helmrelease.yaml, change:
   tag: v1.3.0
   # to:
   tag: v2.0.0
   ```

3. **Apply changes and monitor**:
   ```bash
   # The pod will restart automatically
   kubectl get pods -n database -w | grep garage

   # Check logs for migration messages
   kubectl logs -n database deployment/garage -f
   ```

4. **If migration fails**, the v2.0.0 binary should provide instructions for manual migration

### Phase 3: Verify v2.0.0 is Working

```bash
# Check cluster status
kubectl exec -n database deployment/garage -- garage -c /etc/garage.toml status

# Verify buckets are accessible
kubectl exec -n database deployment/garage -- garage -c /etc/garage.toml bucket list

# Test S3 API access
curl -I https://s3.${SECRET_DOMAIN}
```

### Phase 4: Upgrade to v2.1.0

Once v2.0.0 is stable:

1. **Update HelmRelease to v2.1.0**:
   ```yaml
   # In helmrelease.yaml, change:
   tag: v2.0.0
   # to:
   tag: v2.1.0
   ```

2. **Apply and verify**:
   ```bash
   kubectl get pods -n database -w | grep garage
   kubectl logs -n database deployment/garage
   ```

## Rollback Plan

If issues occur at any stage:

1. **Revert HelmRelease** to v1.3.0
2. **Restore configmap.yaml** from backup:
   ```bash
   mv kubernetes/apps/database/garage/app/configmap-v1.yaml.bak kubernetes/apps/database/garage/app/configmap.yaml
   ```
3. **Delete the pod** to force recreation:
   ```bash
   kubectl delete pod -n database -l app.kubernetes.io/name=garage
   ```

## Known Issues

- **LMDB errors**: If you see "Resource temporarily unavailable", the database format is incompatible
- **Admin API changes**: v2.x uses `/v2/` endpoints instead of `/v1/`
- **Config changes**: `replication_mode` must be replaced with `replication_factor` + `consistency_mode`

## Post-Migration Tasks

1. **Update any scripts** that use Garage admin API to use v2 endpoints
2. **Re-apply CORS settings** to buckets if needed
3. **Test application connectivity** (Outline, KAN, PostgreSQL backups)
4. **Update monitoring/alerts** for v2.x compatibility

## Support

- Garage v2.0.0 release notes: https://garagehq.deuxfleurs.fr/blog/2025-06-garage-v2/
- Migration guides: https://garagehq.deuxfleurs.fr/documentation/operations/upgrading/