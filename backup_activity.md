# Backup Activity Report - VolSync Implementation

## Overview
Successfully implemented VolSync backup solution for Plex configuration data, enabling automated backups from Kubernetes Ceph storage to NAS via NFS.

## Completed Tasks

### 1. Cluster Recovery and API Server Fix
- **Issue**: Cluster API server was failing with "not yet ready to handle request" errors
- **Root Cause**: MutatingAdmissionPolicy feature gate was enabled but v1alpha1 API was not available
- **Solution**: Removed MutatingAdmissionPolicy feature gate to restore cluster functionality
- **Result**: Cluster API server restored to full functionality

### 2. Flux Webhook Restoration
- **Issue**: GitHub webhook was returning 502 errors after cluster failure
- **Root Cause**: Missing flux-system secret and notification-controller deployment
- **Solution**: Recreated flux-system secret with GitHub deploy key
- **Result**: Webhook functional, GitHub push notifications working

### 3. VolSync Installation and Configuration
- **Installed**: VolSync v0.13.0-rc.2 from home-operations chart mirror
- **Configured**: ReplicationSource for Plex config backup
- **Method**: Transitioned from rsync to restic for better reliability
- **Storage**: Uses Ceph RBD for source PVC and temporary volumes

### 4. NFS Backup Integration
- **Challenge**: VolSync doesn't natively support NFS destinations
- **Solution**: Implemented MutatingAdmissionPolicy to automatically inject NFS mounts
- **Policy**: `volsync-mover-nfs` automatically mounts NAS backup location at `/repository`
- **Target**: `nas.cftollefsen.com:/mnt/truenas/cf-nas/backup` → `/repository`

### 5. Talos Configuration Updates
- **Enabled**: MutatingAdmissionPolicy feature gate in API server
- **Added**: `feature-gates: MutatingAdmissionPolicy=true`
- **Added**: `runtime-config: admissionregistration.k8s.io/v1alpha1=true`
- **Result**: MutatingAdmissionPolicy v1alpha1 API available

### 6. Snapshot-Based Backup Implementation
- **Created**: VolumeSnapshotClass for Ceph RBD (`csi-rbd-sc`)
- **Fixed**: Cluster ID configuration (`e4a4c987-4801-40ad-a6ae-bfdecbec3df4`)
- **Method**: Changed from Direct to Snapshot copy method
- **Benefit**: Point-in-time consistency without application downtime

### 7. Secret Management Integration
- **External Secrets**: Configured with OnePassword integration
- **Variables**: Added cluster-secrets substitution to volsync kustomization
- **Repository**: `RESTIC_REPOSITORY: "/repository/plex"`
- **Authentication**: Restic password managed via external secrets

## Current Status

### ✅ Working Components
- **Cluster**: Fully operational with API server stable
- **VolSync**: Installed and configured
- **Snapshots**: VolumeSnapshotClass working correctly
- **NFS Mount**: MutatingAdmissionPolicy injecting NFS volumes successfully
- **Mover Pods**: Starting and running (no longer stuck in ContainerCreating)
- **Backup Process**: Initializing restic repository

### 🔄 In Progress
- **First Backup**: Restic repository initialization in progress
- **Backup Verification**: Need to confirm successful data transfer to NAS

## Configuration Details

### ReplicationSource Configuration
```yaml
spec:
  sourcePVC: plex
  trigger:
    schedule: "0 3 * * *"  # Daily at 3 AM
  restic:
    copyMethod: Snapshot
    storageClassName: csi-rbd-sc
    volumeSnapshotClassName: csi-rbd-sc
    repository: plex-secret
    retain:
      daily: 7
      weekly: 4
      monthly: 3
```

### MutatingAdmissionPolicy Flow
1. VolSync creates backup job
2. Policy detects job with `volsync-` prefix
3. Automatically injects NFS volume mount:
   - Server: `nas.cftollefsen.com`
   - Path: `/mnt/truenas/cf-nas/backup`
   - Mount Point: `/repository`
4. Restic writes to `/repository/plex`

### Backup Data Flow
```
Plex PVC → VolumeSnapshot → Restic Backup → NFS Mount (/repository/plex) → NAS (/mnt/truenas/cf-nas/backup/plex)
```

## Remaining Issues

### 1. First Backup Completion
- **Status**: Repository initialization in progress
- **Next Steps**: Monitor backup completion and verify data on NAS
- **Verification**: Check `/mnt/truenas/cf-nas/backup/plex` on NAS

### 2. Backup Monitoring
- **Need**: Confirmation of successful backup completion
- **Monitoring**: Check ReplicationSource status and mover pod logs
- **Alerting**: No monitoring/alerting configured yet

## Future Tasks

### 1. Backup Verification
- [ ] Verify first backup completes successfully
- [ ] Check backup data exists on NAS
- [ ] Test restore functionality

### 2. Expand to Other Applications
- [ ] Implement backup for other media apps (Sonarr, Radarr, etc.)
- [ ] Use same pattern with different repository paths
- [ ] Consider shared external secrets for restic password

### 3. Monitoring and Alerting
- [ ] Set up backup success/failure monitoring
- [ ] Configure alerting for backup failures
- [ ] Dashboard for backup status

### 4. Documentation
- [ ] Document backup restoration procedures
- [ ] Create runbook for backup troubleshooting
- [ ] Document expanding to additional applications

## Lessons Learned

1. **MutatingAdmissionPolicy**: Powerful for injecting infrastructure concerns (NFS mounts) into application pods
2. **Variable Substitution**: Flux substitution must be configured in kustomization for policies to work
3. **Snapshot Configuration**: Cluster ID must match exactly between StorageClass and VolumeSnapshotClass
4. **Backup Strategy**: Snapshot-based backups provide better consistency than direct methods
5. **Troubleshooting**: Step-by-step validation of each component crucial for complex integrations

## Key Files Modified

- `talos/patches/controller/cluster.yaml` - Enabled MutatingAdmissionPolicy
- `kubernetes/apps/volsync-system/volsync/app/mutatingadmissionpolicy.yaml` - Uncommented NFS policy
- `kubernetes/apps/volsync-system/volsync/ks.yaml` - Added cluster-secrets substitution
- `kubernetes/apps/ceph-csi-rbd/volumesnapshotclass.yaml` - Created snapshot class
- `kubernetes/apps/media/plex/app/replicationsource.yaml` - Configured backup
- `kubernetes/apps/media/plex/app/externalsecret.yaml` - Added restic secrets

## Contact Information
For questions or issues, refer to this activity log and the configuration files mentioned above.