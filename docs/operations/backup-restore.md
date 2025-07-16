# Backup and Restore Operations

## Overview

The cluster implements a comprehensive backup strategy using VolSync for application data and CloudNative-PG for database backups. All backups are centralized on TrueNAS for easy management and disaster recovery.

## Backup Architecture

### Technologies Used
- **VolSync v0.13.0-rc.2**: Application PVC backup using restic
- **CloudNative-PG**: PostgreSQL database backup with barman-cloud
- **SeaweedFS**: S3-compatible storage for database backups
- **TrueNAS**: Central backup repository via NFS

### Backup Schedule
- **Applications**: Daily at 3:00 AM UTC
- **Databases**: Daily at 12:00 AM UTC
- **Retention**: 7 daily, 4 weekly, 3 monthly (apps), 7 days (databases)

## Application Backups (VolSync)

### Backup Process
1. **Snapshot Creation**: VolumeSnapshot taken for point-in-time consistency
2. **Restic Backup**: Data backed up to restic repository
3. **NFS Storage**: Backup stored on TrueNAS via NFS mount
4. **Verification**: Backup integrity verified

### Backup Configuration
```yaml
# Standard VolSync ReplicationSource
apiVersion: volsync.backube/v1alpha1
kind: ReplicationSource
metadata:
  name: ${APP}
  namespace: ${NAMESPACE}
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

### Backed Up Applications

#### Critical Applications (High Priority)
- **Home Assistant**: Smart home configuration and history
- **Affine**: Document workspace and files
- **Plex**: Media server metadata and configuration
- **Authentik**: Identity provider configuration
- **Zigbee**: IoT device network configuration

#### Media Applications (Medium Priority)
- **Sonarr**: TV show monitoring and metadata
- **Radarr**: Movie management and metadata
- **Prowlarr**: Indexer configuration
- **Jellyseerr**: Request management
- **Tautulli**: Plex analytics and statistics
- **Bazarr**: Subtitle management
- **Sabnzbd**: Usenet download configuration
- **QBittorrent**: Torrent client state
- **Wizarr**: User invitation system
- **Audiobookshelf**: Listening progress and metadata

### Backup Status Monitoring
```bash
# Check backup status
kubectl get replicationsource -A

# View backup logs
kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=volsync-src-${APP}

# Check backup secret
kubectl get secret ${APP}-volsync-secret -n ${NAMESPACE}
```

## Database Backups (CloudNative-PG)

### PostgreSQL Cluster Backup
```yaml
# Database backup configuration
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres17
spec:
  backup:
    retentionPolicy: 7d
    barmanObjectStore:
      data:
        compression: bzip2
      wal:
        compression: bzip2
        maxParallel: 2
      destinationPath: s3://postgres17/
      endpointURL: http://seaweedfs.database.svc.cluster.local:8888
      serverName: postgres17-v1
      s3Credentials:
        accessKeyId:
          name: cloudnative-pg-secret
          key: aws-access-key-id
        secretAccessKey:
          name: cloudnative-pg-secret
          key: aws-secret-access-key
```

### Scheduled Database Backups
```yaml
# Daily database backup
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: postgres17
spec:
  schedule: "@daily"
  immediate: true
  backupOwnerReference: self
  cluster:
    name: postgres17
```

### Database Applications
- **Authentik**: Identity provider data
- **Authelia**: Authentication middleware
- **LLDAP**: LDAP directory
- **Affine**: Document management
- **Mealie**: Recipe database
- **Additional apps**: Various application databases

## Backup Storage

### NFS Backup Repository
```
/mnt/truenas/cf-nas/backup/
├── affine/                    # Application-specific backups
├── audiobookshelf/
├── bazarr/
├── home-assistant/
├── jellyseerr/
├── plex/
├── postgres17/                # Database backups
│   ├── buckets/              # SeaweedFS metadata
│   └── postgres17/           # Database files
├── prowlarr/
├── qbittorrent/
├── radarr/
├── sabnzbd/
├── sonarr/
├── tautulli/
├── wizarr/
└── zigbee/
```

### Backup Sizes and Characteristics
- **Plex**: ~3.3GB (25K files) - Largest backup
- **Home Assistant**: ~500MB - Configuration and history
- **Radarr**: ~329MB (1.3K files) - Movie metadata
- **Sonarr**: ~71MB (22 files) - TV show configuration
- **QBittorrent**: ~24MB (22 files) - Torrent state
- **Others**: Various sizes based on application data

## Restore Procedures

### Application Restore Process

#### 1. Identify Backup
```bash
# List available backups
kubectl get replicationsource ${APP} -n ${NAMESPACE} -o yaml

# Check backup repository
restic -r /mnt/truenas/cf-nas/backup/${APP} snapshots
```

#### 2. Stop Application
```bash
# Scale deployment to 0
kubectl scale deployment ${APP} --replicas=0 -n ${NAMESPACE}

# Verify pods are stopped
kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=${APP}
```

#### 3. Create ReplicationDestination
```yaml
# Restore configuration
apiVersion: volsync.backube/v1alpha1
kind: ReplicationDestination
metadata:
  name: ${APP}-restore
  namespace: ${NAMESPACE}
spec:
  trigger:
    manual: restore-$(date +%Y%m%d-%H%M%S)
  restic:
    repository: ${APP}-volsync-secret
    destinationPVC: ${APP}
    storageClassName: csi-rbd-sc
    accessModes:
      - ReadWriteOnce
    capacity: ${ORIGINAL_SIZE}
    moverSecurityContext:
      runAsUser: 1000
      runAsGroup: 1000
      fsGroup: 1000
```

#### 4. Monitor Restore
```bash
# Check restore status
kubectl get replicationdestination ${APP}-restore -n ${NAMESPACE}

# View restore logs
kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=volsync-dst-${APP}-restore
```

#### 5. Restart Application
```bash
# Scale deployment back up
kubectl scale deployment ${APP} --replicas=1 -n ${NAMESPACE}

# Verify application is running
kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=${APP}
```

### Database Restore Process

#### 1. Identify Database Backup
```bash
# List available backups
kubectl exec -it postgres17-1 -n database -- barman-cloud-backup-list \
  --cloud-provider aws-s3 \
  --endpoint-url http://seaweedfs.database.svc.cluster.local:8888 \
  s3://postgres17/ postgres17-v1
```

#### 2. Create Recovery Cluster
```yaml
# Recovery cluster configuration
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres17-recovery
spec:
  instances: 1
  
  bootstrap:
    recovery:
      source: postgres17-backup
      
  externalClusters:
    - name: postgres17-backup
      barmanObjectStore:
        destinationPath: s3://postgres17/
        endpointURL: http://seaweedfs.database.svc.cluster.local:8888
        serverName: postgres17-v1
        s3Credentials:
          accessKeyId:
            name: cloudnative-pg-secret
            key: aws-access-key-id
          secretAccessKey:
            name: cloudnative-pg-secret
            key: aws-secret-access-key
```

#### 3. Verify Recovery
```bash
# Check cluster status
kubectl get cluster postgres17-recovery -n database

# Verify database connectivity
kubectl exec -it postgres17-recovery-1 -n database -- psql -U postgres -c "\l"
```

## Disaster Recovery

### Complete Cluster Recovery

#### 1. Infrastructure Recovery
```bash
# Rebuild Talos cluster
task bootstrap:talos

# Bootstrap applications
task bootstrap:apps
```

#### 2. Application Data Recovery
```bash
# Restore all applications (automated via GitOps)
task reconcile

# Verify backup systems are operational
kubectl get replicationsource -A
```

#### 3. Database Recovery
```bash
# Restore PostgreSQL cluster
kubectl apply -f postgres17-recovery.yaml

# Verify database applications
kubectl get pods -n database
```

### Recovery Testing

#### Monthly Recovery Test
1. **Test Environment**: Create isolated test namespace
2. **Sample Restore**: Restore one application from backup
3. **Verification**: Confirm data integrity and application functionality
4. **Documentation**: Record test results and any issues
5. **Cleanup**: Remove test resources

#### Quarterly Full Test
1. **Complete Restore**: Full cluster recovery simulation
2. **Application Testing**: Verify all applications are functional
3. **Database Testing**: Confirm database integrity and connectivity
4. **Performance Testing**: Verify system performance post-recovery
5. **Documentation**: Update recovery procedures based on findings

## Monitoring and Alerting

### Backup Health Monitoring
```yaml
# Prometheus rule for backup monitoring
groups:
  - name: backup.rules
    rules:
      - alert: VolSyncBackupFailed
        expr: volsync_replication_source_last_sync_time{job="volsync-metrics"} < (time() - 86400)
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "VolSync backup failed for {{ $labels.obj_name }}"
          description: "Backup for {{ $labels.obj_name }} has not succeeded in 24 hours"
```

### Key Metrics
- **Backup Success Rate**: Percentage of successful backups
- **Backup Duration**: Time taken for backup completion
- **Storage Usage**: Backup repository size and growth
- **Recovery Time**: Time to restore from backup

## Backup Security

### Encryption
- **Repository Encryption**: All restic repositories encrypted
- **Transport Security**: TLS encryption for all backup transfers
- **Key Management**: Backup encryption keys stored in OnePassword
- **Access Control**: RBAC restricts backup resource access

### Access Control
```yaml
# Backup operator RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: backup-operator
rules:
  - apiGroups: ["volsync.backube"]
    resources: ["replicationsources", "replicationdestinations"]
    verbs: ["get", "list", "create", "update", "patch", "delete"]
  - apiGroups: ["snapshot.storage.k8s.io"]
    resources: ["volumesnapshots"]
    verbs: ["get", "list", "create", "delete"]
```

## Best Practices

### Backup Operations
1. **Regular Testing**: Monthly restore testing for critical applications
2. **Monitoring**: Continuous monitoring of backup health and status
3. **Documentation**: Keep recovery procedures up-to-date
4. **Automation**: Automated backup verification and alerting
5. **Retention**: Regular cleanup of old backups per retention policy

### Security
1. **Encryption**: All backups encrypted at rest and in transit
2. **Access Control**: Principle of least privilege for backup access
3. **Key Rotation**: Regular rotation of backup encryption keys
4. **Audit**: Regular audit of backup access and operations

---

**Last Updated**: 2025-07-16  
**Backup Coverage**: 13+ applications + PostgreSQL databases  
**Recovery Objective**: 24-hour RPO, 2-hour RTO  
**Next Review**: 2025-10-16