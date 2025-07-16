# Application Backup Strategy - Kubernetes Home Cluster

## Overview

This document outlines the comprehensive backup strategy for the Kubernetes home cluster, implemented using VolSync for application data and CloudNative-PG for database backups. All backups are stored centrally on the NAS for easy management and recovery.

## Backup Infrastructure

### **Primary Technologies**
- **VolSync v0.13.0-rc.2**: Application PVC backup using restic with snapshot-based consistency
- **CloudNative-PG**: PostgreSQL database backup with barman-cloud
- **SeaweedFS**: S3-compatible storage for database backups
- **NFS Storage**: Direct mount to NAS for centralized backup storage

### **Storage Backend**
- **Primary Storage**: TrueNAS (`nas.cftollefsen.com`)
- **Backup Location**: `/mnt/truenas/cf-nas/backup/`
- **Method**: Restic repositories with compression (bzip2)
- **Network**: NFS mounts for reliable cross-cluster access

## Application Backups (VolSync)

### **Critical Applications - Daily Backup at 3 AM**

#### **Smart Home & IoT**
- **Home Assistant** (`default/home-assistant`)
  - **Data**: Complete smart home configuration, device history, automations
  - **Storage**: 5Gi main + 1Gi cache
  - **Criticality**: HIGH - Months of configuration and historical data

- **Zigbee** (`default/zigbee`)
  - **Data**: Zigbee network configuration, device pairings
  - **Storage**: 2Gi
  - **Criticality**: MEDIUM-HIGH - Device re-pairing is time-consuming

#### **Document Management**
- **Affine** (`default/affine`)
  - **Data**: Document workspace data, file attachments
  - **Storage**: 2Gi
  - **Criticality**: HIGH - Document workspace content

#### **Entertainment & Media**
- **Audiobookshelf** (`media/audiobookshelf`)
  - **Data**: Listening progress, user metadata, bookmarks
  - **Storage**: 2Gi
  - **Criticality**: MEDIUM-HIGH - User progress tracking

#### **Media Management Suite**
- **Plex** (`media/plex`)
  - **Data**: Media server configuration, metadata, artwork
  - **Storage**: Large dataset (~3.3GB, 25K files)
  - **Criticality**: HIGH - Extensive metadata and customization

- **Sonarr** (`media/sonarr`)
  - **Data**: TV show monitoring configuration
  - **Storage**: Small config (~71MB, 22 files)
  - **Criticality**: MEDIUM - Recreatable but time-consuming

- **Radarr** (`media/radarr`)
  - **Data**: Movie monitoring configuration, metadata
  - **Storage**: Medium dataset (~329MB, 1.3K files)
  - **Criticality**: MEDIUM - Movie metadata and quality profiles

- **Prowlarr** (`media/prowlarr`)
  - **Data**: Indexer configuration and settings
  - **Storage**: Minimal (~552KB, 579 files)
  - **Criticality**: LOW-MEDIUM - Indexer configuration

- **QBittorrent** (`media/qbittorrent`)
  - **Data**: Torrent client configuration, state
  - **Storage**: Small dataset (~23.6MB, 22 files)
  - **Criticality**: MEDIUM - Torrent state and categories

#### **Additional Media Tools**
- **Jellyseerr** (`media/jellyseerr`) - Request management
- **Bazarr** (`media/bazarr`) - Subtitle management
- **Sabnzbd** (`media/sabnzbd`) - Usenet downloader
- **Tautulli** (`media/tautulli`) - Plex analytics
- **Wizarr** (`media/wizarr`) - User invitation system

### **VolSync Configuration Details**

```yaml
# Standard VolSync Component Configuration
spec:
  sourcePVC: ${APP}                    # Dynamic PVC name matching
  trigger:
    schedule: "0 3 * * *"              # Daily at 3 AM
  restic:
    copyMethod: Snapshot               # Point-in-time consistency
    storageClassName: csi-rbd-sc       # Ceph RBD storage class
    volumeSnapshotClassName: csi-rbd-sc
    repository: ${APP}-volsync-secret  # Unique repository per app
    retain:
      daily: 7                         # 7 days retention
      weekly: 4                        # 4 weeks retention  
      monthly: 3                       # 3 months retention
    moverSecurityContext:
      runAsUser: 1000
      runAsGroup: 1000
      fsGroup: 1000
```

### **MutatingAdmissionPolicy Integration**
- **Automatic NFS Mount Injection**: Policy `volsync-mover-nfs` automatically mounts NAS backup location
- **Mount Point**: `/repository` in backup pods
- **Target Path**: `nas.cftollefsen.com:/mnt/truenas/cf-nas/backup`
- **Result**: Each app gets dedicated folder (`/repository/${APP}`)

## Database Backups (CloudNative-PG)

### **PostgreSQL 17 Cluster**
- **Cluster Name**: `postgres17`
- **Instances**: 3-node cluster (postgres17-1, postgres17-2, postgres17-3)
- **Storage**: 3x 40Gi Ceph RBD PVCs
- **Primary**: Automatically managed failover

### **Database Applications**

#### **Authentication & Identity**
- **Authentik** - Identity provider, SSO configuration
- **Authelia** - Authentication middleware
- **LLDAP** - Lightweight LDAP directory

#### **Application Databases**
- **Affine** - Document management metadata
- **Mealie** - Recipe database (static files backed up separately)
- **Additional apps** - Various application-specific databases

### **Database Backup Configuration**

```yaml
# CloudNative-PG Backup Configuration
backup:
  retentionPolicy: 7d                  # 7 days retention
  barmanObjectStore:
    data:
      compression: bzip2               # Data compression
    wal:
      compression: bzip2               # WAL compression (if working)
      maxParallel: 2                   # Parallel WAL processing
    destinationPath: s3://postgres17/  # S3 bucket path
    endpointURL: http://seaweedfs.database.svc.cluster.local:8888
    serverName: postgres17-v1          # Cluster identifier
    s3Credentials:                     # SeaweedFS credentials
      accessKeyId: { name: cloudnative-pg-secret, key: aws-access-key-id }
      secretAccessKey: { name: cloudnative-pg-secret, key: aws-secret-access-key }
```

### **Scheduled Database Backups**

```yaml
# Daily Database Backup Schedule
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: postgres17
spec:
  schedule: "@daily"                   # Daily at midnight
  immediate: true                      # Enable immediate backup testing
  backupOwnerReference: self
  cluster:
    name: postgres17
```

### **Backup Method & Limitations**
- **✅ Base Backups**: Daily full database snapshots (WORKING)
- **❌ WAL Archiving**: Continuous transaction logs (SeaweedFS compatibility issue)
- **Recovery Window**: Up to 24 hours of potential data loss
- **Storage**: SeaweedFS → NAS (`/mnt/truenas/cf-nas/backup/postgres17/`)

## Storage Infrastructure

### **Source Storage**
- **Ceph Cluster**: Primary storage for application PVCs
- **Storage Classes**: 
  - `csi-rbd-sc` - Block storage for most applications
  - `csi-cephfs-sc` - Shared filesystem storage
- **Snapshots**: `csi-rbd-sc` VolumeSnapshotClass for consistency

### **Backup Storage Hierarchy**
```
/mnt/truenas/cf-nas/backup/
├── affine/                    # Affine workspace data
├── audiobookshelf/            # Listening progress
├── bazarr/                    # Subtitle management config
├── home-assistant/            # Smart home configuration
├── jellyseerr/                # Request management
├── plex/                      # Media server configuration
├── postgres17/                # Database backups (SeaweedFS format)
│   ├── buckets/              # SeaweedFS metadata
│   └── postgres17/           # Actual S3 bucket data
├── prowlarr/                  # Indexer configuration
├── qbittorrent/              # Torrent client state
├── radarr/                   # Movie management
├── sabnzbd/                  # Usenet downloader
├── sonarr/                   # TV show management
├── tautulli/                 # Plex analytics
├── wizarr/                   # User invitation system
└── zigbee/                   # Zigbee network config
```

## Secret Management

### **External Secrets Integration**
- **OnePassword**: Primary secret store
- **ClusterSecretStore**: `onepassword` for credential management
- **Per-App Secrets**: `${APP}-volsync-secret` for each application
- **Database Secrets**: `cloudnative-pg-secret` with S3 credentials

### **Credential Structure**
```yaml
# VolSync Secrets (per application)
data:
  RESTIC_REPOSITORY: "/repository/${APP}"
  RESTIC_PASSWORD: "{{ .RESTIC_PASSWORD }}"

# Database Backup Secrets
data:
  username: "{{ .POSTGRES_SUPER_USER }}"
  password: "{{ .POSTGRES_SUPER_PASS }}"
  aws-access-key-id: "{{ .S3_ACCESS_KEY }}"
  aws-secret-access-key: "{{ .S3_SECRET_KEY }}"
```

## Backup Schedule & Timing

### **Coordinated Backup Windows**
- **3:00 AM**: Application PVC backups (VolSync)
- **12:00 AM**: Database backups (CloudNative-PG)
- **Staggered Execution**: Prevents resource contention
- **Timezone**: UTC (cluster timezone)

### **Retention Policies**
- **Daily**: 7 days (1 week of daily restore points)
- **Weekly**: 4 weeks (1 month of weekly restore points)
- **Monthly**: 3 months (quarterly restore points)
- **Database**: 7 days (daily snapshots only)

## Recovery Procedures

### **Application Recovery (VolSync)**
1. **Identify Target**: Determine application and restore point
2. **Stop Application**: Scale deployment to 0 replicas
3. **Create ReplicationDestination**: Configure restore job
4. **Restore Data**: VolSync restores from restic repository
5. **Restart Application**: Scale deployment back to normal

### **Database Recovery (CloudNative-PG)**
1. **Identify Backup**: List available base backups
2. **Create Recovery Cluster**: New cluster with bootstrap configuration
3. **Point-in-Time**: Limited to daily backup points (no WAL archiving)
4. **Data Migration**: Application reconnection to restored cluster

### **Complete Disaster Recovery**
1. **NAS Backup**: All data centralized on TrueNAS
2. **Cluster Rebuild**: Talos + Flux can recreate infrastructure
3. **Application Restore**: VolSync components restore app data
4. **Database Restore**: CloudNative-PG restores authentication and app DBs
5. **Secret Recovery**: OnePassword provides all credentials

## Monitoring & Alerting

### **Backup Health Checks**
- **ReplicationSource Status**: Monitor for backup failures
- **Secret Sync Status**: External secrets validation
- **Storage Utilization**: NAS capacity monitoring
- **Network Connectivity**: NFS mount health

### **Key Metrics**
- **Backup Success Rate**: Per-application success/failure tracking
- **Backup Duration**: Performance monitoring
- **Storage Growth**: Repository size trends
- **Recovery Testing**: Periodic restore validation

## Security Considerations

### **Data Protection**
- **Encryption**: Restic repository encryption with rotating passwords
- **Access Control**: Kubernetes RBAC for backup resources
- **Network Security**: NFS access restricted to cluster nodes
- **Credential Management**: External secrets with OnePassword integration

### **Compliance & Retention**
- **Data Retention**: Automated cleanup per retention policies
- **Backup Integrity**: Restic repository verification
- **Access Logging**: Kubernetes audit logs for backup operations

## Future Improvements

### **Planned Enhancements**
1. **WAL Archiving**: Investigate MinIO as SeaweedFS alternative for PostgreSQL
2. **Backup Monitoring**: Prometheus metrics and Grafana dashboards
3. **Automated Testing**: Scheduled recovery testing
4. **Cross-Site Backup**: Secondary backup location for disaster recovery
5. **Application Expansion**: Additional applications as they're deployed

### **Optimization Opportunities**
1. **Backup Windows**: Optimize timing to reduce resource contention
2. **Compression**: Evaluate compression ratios vs. performance
3. **Incremental Backups**: Leverage restic deduplication
4. **Network Optimization**: Dedicated backup network for large transfers

---

**Last Updated**: 2025-07-16  
**Backup Coverage**: 13+ applications with persistent data  
**Total Protected Data**: ~4GB application data + PostgreSQL databases  
**Recovery Objective**: 24-hour RPO, 1-hour RTO for most applications