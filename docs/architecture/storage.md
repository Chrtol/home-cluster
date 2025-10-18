# Storage Architecture

## Storage Overview

The cluster implements a hybrid storage architecture combining high-performance Ceph storage for applications with high-capacity NFS storage for media and backups. This design optimizes both performance and cost while ensuring data reliability and availability.

## Storage Tiers

### Primary Storage: Ceph Cluster
- **Purpose**: Application persistent volumes and database storage
- **Technology**: Ceph RBD (block storage) and CephFS (shared filesystem)
- **Performance**: High IOPS, low latency for application workloads
- **Redundancy**: Replicated across cluster nodes
- **Scalability**: Horizontal scaling with additional nodes

### Secondary Storage: TrueNAS NFS
- **Purpose**: Media files, backups, and large file storage
- **Technology**: ZFS with RAIDZ1 configuration
- **Capacity**: 36TB usable storage (4x 12TB drives)
- **Performance**: Optimized for streaming and large file access
- **Backup**: Centralized backup repository for all applications

## TrueNAS Configuration

### Hardware Setup
- **System**: Aoostar WTR Pro with Intel N150
- **Storage**: 4x 12TB HDDs in RAIDZ1 configuration
- **Cache**: 256GB NVMe L2ARC cache for performance
- **Memory**: 16GB RAM (upgrading to 32GB planned)
- **Network**: 2x 2.5GbE (planning VPC/LAG configuration)

### Storage Pool Configuration
```yaml
# TrueNAS Pool Configuration
Pool Name: truenas
Pool Type: RAIDZ1
Drives: 4x 12TB HDDs
Usable Space: 36TB (75% efficiency)
Redundancy: Single disk failure tolerance
Features:
  - Compression: LZ4
  - Checksum: SHA256
  - Encryption: Disabled (performance)
  - Deduplication: Disabled (memory)
```

### Performance Optimization
- **L2ARC Cache**: 256GB NVMe for frequently accessed data
- **ARC Cache**: ~13GB RAM for metadata and hot data
- **ZFS Prefetch**: Enabled for sequential read optimization
- **Network**: 2.5GbE for high-throughput transfers

### Dataset Structure
```
/mnt/truenas/
├── cf-nas/                    # Main application data
│   ├── media/                 # Media files (movies, TV, books)
│   ├── downloads/             # Download staging area
│   └── backup/                # Backup repositories
│       ├── affine/            # Application backups
│       ├── audiobookshelf/    # (individual app folders)
│       ├── home-assistant/    # 
│       ├── plex/              # Media server config
│       └── postgres17/        # Database backups
└── datasets/                  # Additional datasets as needed
```

## Ceph Storage

### Ceph Architecture
- **Deployment**: Ceph cluster across Kubernetes nodes
- **Components**: MON (monitors), OSD (object storage), MDS (metadata)
- **Replication**: 3x replication for data durability
- **Performance**: SSD-based storage for low latency

### Storage Classes

#### RBD (Block Storage)
```yaml
# Ceph RBD StorageClass
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: csi-rbd-sc
provisioner: rbd.csi.ceph.com
parameters:
  clusterID: e4a4c987-4801-40ad-a6ae-bfdecbec3df4
  pool: csi-rbd-pool
  imageFeatures: layering
  csi.storage.k8s.io/provisioner-secret-name: csi-rbd-secret
  csi.storage.k8s.io/provisioner-secret-namespace: ceph-csi-rbd
  csi.storage.k8s.io/controller-expand-secret-name: csi-rbd-secret
  csi.storage.k8s.io/controller-expand-secret-namespace: ceph-csi-rbd
  csi.storage.k8s.io/node-stage-secret-name: csi-rbd-secret
  csi.storage.k8s.io/node-stage-secret-namespace: ceph-csi-rbd
allowVolumeExpansion: true
reclaimPolicy: Delete
volumeBindingMode: Immediate
```

#### CephFS (Shared Filesystem)
```yaml
# CephFS StorageClass
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: csi-cephfs-sc
provisioner: cephfs.csi.ceph.com
parameters:
  clusterID: e4a4c987-4801-40ad-a6ae-bfdecbec3df4
  fsName: cephfs
  pool: csi-cephfs-data-pool
  csi.storage.k8s.io/provisioner-secret-name: csi-cephfs-secret
  csi.storage.k8s.io/provisioner-secret-namespace: ceph-csi-cephfs
  csi.storage.k8s.io/controller-expand-secret-name: csi-cephfs-secret
  csi.storage.k8s.io/controller-expand-secret-namespace: ceph-csi-cephfs
  csi.storage.k8s.io/node-stage-secret-name: csi-cephfs-secret
  csi.storage.k8s.io/node-stage-secret-namespace: ceph-csi-cephfs
allowVolumeExpansion: true
reclaimPolicy: Delete
volumeBindingMode: Immediate
```

## NFS Integration

### NFS Server Configuration
```yaml
# TrueNAS NFS Export
Export Name: cf-nas
Path: /mnt/truenas/cf-nas
Network: 10.0.30.0/24
Maproot: kubernetes (UID 1000)
Options:
  - All Directories: Enabled
  - Read Only: Disabled
  - Quiet: Disabled
```

### NFS StorageClass
```yaml
# NFS StorageClass for media storage
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-media
provisioner: nfs.csi.k8s.io
parameters:
  server: nas.example.com
  share: /mnt/truenas/cf-nas/media
  mountPermissions: "0755"
reclaimPolicy: Retain
volumeBindingMode: Immediate
```

## Backup Strategy

### Application Backups (VolSync)
- **Technology**: VolSync with Restic repositories
- **Method**: Snapshot-based backups for consistency
- **Schedule**: Daily at 3 AM
- **Retention**: 7 daily, 4 weekly, 3 monthly
- **Destination**: TrueNAS NFS mount

### Database Backups (CloudNative-PG)
- **Technology**: Barman-cloud with S3 backend
- **Storage**: SeaweedFS S3-compatible storage
- **Schedule**: Daily at midnight
- **Retention**: 7 days
- **Destination**: SeaweedFS → TrueNAS backup directory

### Backup Configuration
```yaml
# VolSync ReplicationSource Template
apiVersion: volsync.backube/v1alpha1
kind: ReplicationSource
metadata:
  name: ${APP}
spec:
  sourcePVC: ${APP}
  trigger:
    schedule: "0 3 * * *"
  restic:
    copyMethod: Snapshot
    storageClassName: csi-rbd-sc
    volumeSnapshotClassName: csi-rbd-sc
    repository: ${APP}-volsync-secret
    retain:
      daily: 7
      weekly: 4
      monthly: 3
    moverSecurityContext:
      runAsUser: 1000
      runAsGroup: 1000
      fsGroup: 1000
```

## Volume Snapshots

### Snapshot Configuration
```yaml
# VolumeSnapshotClass for Ceph RBD
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata:
  name: csi-rbd-sc
driver: rbd.csi.ceph.com
parameters:
  clusterID: e4a4c987-4801-40ad-a6ae-bfdecbec3df4
  csi.storage.k8s.io/snapshotter-secret-name: csi-rbd-secret
  csi.storage.k8s.io/snapshotter-secret-namespace: ceph-csi-rbd
deletionPolicy: Delete
```

### Snapshot Usage
- **Backup Operations**: Point-in-time consistency for backups
- **Testing**: Safe testing with snapshot rollback
- **Disaster Recovery**: Rapid recovery from known good state
- **Development**: Clone production data for development

## Storage Monitoring

### Key Metrics
- **Ceph Health**: Cluster health and OSD status
- **Storage Usage**: Capacity utilization and growth trends
- **Performance**: IOPS, throughput, and latency metrics
- **Backup Status**: Backup success rates and retention

### Monitoring Tools
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Storage dashboards and visualization
- **Ceph Dashboard**: Native Ceph monitoring interface
- **TrueNAS**: ZFS health and performance monitoring

## Performance Characteristics

### Ceph Performance
- **Block Storage**: High IOPS for database workloads
- **Shared Storage**: Concurrent access for shared applications
- **Network**: High-throughput for large file transfers
- **Latency**: Low latency for application responsiveness

### NFS Performance
- **Streaming**: Optimized for media streaming workloads
- **Large Files**: Efficient handling of large media files
- **Caching**: L2ARC cache improves frequently accessed data
- **Network**: 2.5GbE provides high bandwidth for transfers

## Disaster Recovery

### Recovery Scenarios

#### Application Data Recovery
1. **Identify Backup**: List available restore points
2. **Stop Application**: Scale deployment to 0 replicas
3. **Restore Volume**: VolSync restores from backup repository
4. **Verify Data**: Confirm data integrity post-restore
5. **Restart Application**: Scale deployment back to normal

#### Complete Cluster Recovery
1. **Infrastructure**: Rebuild Talos cluster from configuration
2. **Applications**: Flux recreates all applications
3. **Data Restore**: VolSync restores all application data
4. **Database Restore**: CloudNative-PG restores databases
5. **Verification**: Comprehensive testing of restored services

### Recovery Objectives
- **RPO (Recovery Point Objective)**: 24 hours for applications, 1 hour for critical data
- **RTO (Recovery Time Objective)**: 2-4 hours for complete cluster recovery
- **Data Integrity**: Checksums and verification for all backups
- **Testing**: Regular disaster recovery testing and validation

## Future Improvements

### Planned Enhancements
1. **TrueNAS Memory**: Upgrade to 32GB for larger ARC cache
2. **Network Aggregation**: Configure VPC/LAG for 5Gbps throughput
3. **Storage Expansion**: Add additional drives to expand capacity
4. **Monitoring**: Enhanced storage monitoring and alerting

### Optimization Opportunities
1. **Ceph Tuning**: Performance optimization based on workload patterns
2. **ZFS Optimization**: Tuning for specific workload characteristics
3. **Network Optimization**: Dedicated storage network for high-bandwidth transfers
4. **Backup Optimization**: Incremental backups and compression optimization

---

**Last Updated**: 2025-07-16  
**Storage Version**: v2.0 (TrueNAS RAIDZ1 + L2ARC)  
**Total Capacity**: 36TB NFS + Ceph distributed storage  
**Next Review**: 2025-10-16