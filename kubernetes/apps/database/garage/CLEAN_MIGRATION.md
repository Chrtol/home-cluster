# Clean Migration from Garage v1.3.0 to v2.1.0

Since the automatic database migration isn't working, we'll do a clean migration.

## Step 1: Export Data from v1.3.0

First, rollback to v1.3.0 and export all data:

```bash
# 1. Install rclone locally or in a pod
# 2. Configure rclone with current Garage credentials

# 3. Export each bucket
rclone sync garage:outline ./backup/outline
rclone sync garage:kan-avatars ./backup/kan-avatars
rclone sync garage:kan-attachments ./backup/kan-attachments
rclone sync garage:postgres-wal ./backup/postgres-wal
```

## Step 2: Clean Database

```bash
# Scale down Garage
kubectl scale deployment garage -n database --replicas=0

# Clear the metadata directory on your NAS
# WARNING: This will delete the Garage database
rm -rf /mnt/truenas/cf-nas/s3/meta/*
```

## Step 3: Deploy Garage v2.1.0

```yaml
# Update helmrelease.yaml
tag: v2.1.0  # Skip v2.0.0, go straight to latest

# Ensure configmap.yaml has v2 format:
replication_factor = 1
consistency_mode = "consistent"
```

## Step 4: Recreate Structure

```bash
# Scale up Garage
kubectl scale deployment garage -n database --replicas=1

# Wait for it to initialize
kubectl logs -n database deployment/garage -f

# Recreate buckets
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml bucket create outline
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml bucket create kan-avatars
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml bucket create kan-attachments
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml bucket create postgres-wal

# Recreate access keys
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml key create outline-key
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml key create kan-key
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml key create postgres-backup

# Grant permissions (use key IDs from output)
kubectl exec -n database deployment/garage -- /garage -c /etc/garage.toml bucket allow --read --write --owner outline --key <KEY_ID>
# ... repeat for each bucket/key pair
```

## Step 5: Restore Data

```bash
# Use rclone to restore data
rclone sync ./backup/outline garage-new:outline
rclone sync ./backup/kan-avatars garage-new:kan-avatars
rclone sync ./backup/kan-attachments garage-new:kan-attachments
rclone sync ./backup/postgres-wal garage-new:postgres-wal
```

## Step 6: Update Application Secrets

Update the access keys in your application secrets with the new keys from v2.1.0.

## Benefits of Clean Migration

1. **Skip the problematic v1→v2 database migration**
2. **Go straight to v2.1.0** (latest stable)
3. **Clean start** with no legacy database issues
4. **Guaranteed compatibility**

## Alternative: Stay on v1.3.0

If this seems too complex, v1.3.0 is working fine for your use case. You can:
- Keep using v1.3.0
- Implement the GitOps S3 bucket component
- Revisit upgrading in the future when migration tools improve