# Infrastructure Applications

Core cluster services and operators that provide the foundation for all other applications.

## GitOps & Deployment

### 🔄 Flux CD
- **Namespace**: flux-system
- **Purpose**: GitOps continuous deployment operator
- **Components**:
  - **flux-operator**: Flux CD operator installation
  - **flux-instance**: Active Flux CD instance

**Core Features**:
- **Git Synchronization**: Automatic cluster state sync with Git repository
- **Helm Release Management**: Automated Helm chart deployments
- **Kustomization**: Configuration overlay management
- **Multi-tenancy**: Namespace-scoped deployments
- **Webhook Integration**: Immediate reconciliation on Git push

**Configuration**:
- **Repository**: GitHub repository for cluster configuration
- **Webhook URL**: `flux-webhook.example.com`
- **Reconciliation**: 10-minute automatic sync interval
- **Manual Sync**: Force sync via webhook or CLI

**GitOps Workflow**:
1. **Configuration Change**: Commit to Git repository
2. **Webhook Trigger**: GitHub webhook notifies Flux
3. **Reconciliation**: Flux applies changes to cluster
4. **Health Check**: Flux monitors deployment status
5. **Rollback**: Automatic rollback on deployment failure

### 📦 Renovate Bot
- **Purpose**: Automated dependency updates
- **Features**:
  - Helm chart version updates
  - Container image updates
  - Kubernetes version tracking
  - Pull request automation
  - Scheduling and grouping

## Certificate Management

### 🔐 cert-manager
- **Namespace**: cert-manager
- **Purpose**: Automated TLS certificate management
- **Provider**: Let's Encrypt ACME integration

**Key Features**:
- **Automatic Issuance**: TLS certificate automation
- **Renewal Management**: Automatic certificate renewal
- **DNS Challenge**: Cloudflare DNS validation
- **Wildcard Certificates**: `*.example.com` domain coverage
- **Certificate Monitoring**: Expiry tracking and alerting

**Certificate Configuration**:
- **ClusterIssuer**: Production Let's Encrypt issuer
- **Wildcard Cert**: Covers all subdomains
- **DNS Validation**: Cloudflare DNS-01 challenge
- **Auto-Renewal**: 30-day renewal window

**Supported Certificate Types**:
- **Ingress TLS**: Automatic ingress certificate injection
- **Custom Certificates**: Application-specific certificates
- **Internal CA**: Self-signed certificates for internal services
- **External Integration**: Third-party certificate authority support

## Secrets Management

### 🔑 External Secrets Operator
- **Namespace**: external-secrets
- **Purpose**: External secret management integration
- **Provider**: 1Password Connect integration

**Core Functionality**:
- **External Integration**: 1Password secret synchronization
- **Kubernetes Secrets**: Automatic secret creation and updates
- **Multi-namespace**: Secrets distributed across namespaces
- **Rotation**: Automatic secret rotation and updates
- **Audit Trail**: Secret access and modification logging

**1Password Integration**:
- **Connect Server**: 1Password Connect for API access
- **Vault Selection**: Specific vault for cluster secrets
- **Item Mapping**: 1Password items to Kubernetes secrets
- **Secure Access**: Token-based authentication

**Secret Types**:
- **Application Credentials**: Database passwords, API keys
- **TLS Certificates**: Private keys and certificates
- **OAuth Tokens**: Authentication service tokens
- **Infrastructure**: Cloud provider credentials

### 🔒 SOPS Encryption
- **Purpose**: Git-stored secret encryption
- **Method**: Age encryption for GitOps secrets
- **Key Management**: Age key stored securely

**Encrypted Resources**:
- **Helm Values**: Sensitive configuration values
- **Kubernetes Secrets**: Critical system secrets
- **Configuration Files**: Infrastructure credentials
- **Backup Encryption**: Backup data protection

## Storage Infrastructure

### 💾 Ceph CSI Drivers
**Ceph RBD CSI**:
- **Namespace**: kube-system
- **Purpose**: Block storage provisioning
- **Features**:
  - Dynamic volume provisioning
  - Volume snapshots
  - Volume cloning
  - Encryption at rest
  - Multi-attach support

**Ceph CephFS CSI**:
- **Purpose**: Shared filesystem storage
- **Features**:
  - ReadWriteMany volumes
  - Subvolume provisioning
  - Snapshot support
  - Multi-pod access
  - POSIX compliance

**Storage Classes**:
- **ceph-block**: High-performance block storage
- **ceph-filesystem**: Shared filesystem storage
- **ceph-block-ssd**: SSD-backed block storage
- **ceph-filesystem-ssd**: SSD-backed shared storage

### 📁 NFS CSI Driver
- **Purpose**: NFS volume provisioning
- **Integration**: TrueNAS NFS server
- **Use Cases**: Media storage, backup targets

**Configuration**:
- **NFS Server**: `nas.example.com`
- **Export Paths**: Various media and backup directories
- **Mount Options**: Optimized for streaming workloads
- **Access Modes**: ReadWriteMany for shared access

### 📸 Volume Snapshot Controller
- **Purpose**: Volume snapshot management
- **Features**:
  - Point-in-time snapshots
  - Volume restoration
  - Snapshot scheduling
  - Cross-namespace snapshots

## Backup & Synchronization

### 🔄 VolSync
- **Namespace**: volsync-system
- **Purpose**: Volume synchronization and backup
- **Method**: Rsync-based replication to NAS

**Backup Strategy**:
- **Source**: Ceph RBD persistent volumes
- **Destination**: NFS shares on TrueNAS
- **Schedule**: Daily incremental backups
- **Retention**: 30-day backup retention
- **Verification**: Automated backup verification

**Supported Applications**:
- **Media Services**: Plex, Sonarr, Radarr configurations
- **Productivity**: Home Assistant, Mealie, Joplin
- **Infrastructure**: Critical application configurations
- **Security**: Authentik and LLDAP data

**Backup Process**:
1. **Snapshot Creation**: Point-in-time volume snapshot
2. **Data Transfer**: Rsync to NAS destination
3. **Verification**: Backup integrity verification
4. **Cleanup**: Old snapshot and backup cleanup
5. **Monitoring**: Backup success/failure alerting

## Database Services

### 🐘 CloudNative-PG
- **Namespace**: database
- **Purpose**: PostgreSQL operator and cluster management
- **Version**: PostgreSQL 17

**Cluster Configuration**:
- **High Availability**: 3-replica PostgreSQL cluster
- **Automatic Failover**: Leader election and failover
- **Backup Management**: Automated backup scheduling
- **Monitoring**: Prometheus metrics integration
- **Connection Pooling**: PgBouncer integration

**Backup Strategy**:
- **WAL Archiving**: Continuous WAL backup
- **Base Backups**: Daily full database backups
- **Point-in-time Recovery**: PITR capability
- **Backup Destination**: S3-compatible storage
- **Retention**: 30-day backup retention

**Databases**:
- **Application Databases**: Individual databases per application
- **Shared Services**: Common database for multiple applications
- **Monitoring**: Dedicated monitoring database
- **User Management**: Role-based database access

### 🗄️ Redis Services
**Dragonfly**:
- **Purpose**: High-performance Redis-compatible cache
- **Features**: Enhanced performance over standard Redis
- **Use Cases**: Session storage, application caching

**Redis**:
- **Purpose**: Traditional Redis instance
- **Features**: Pub/sub, caching, session storage
- **Configuration**: Persistence enabled, cluster mode

### 📦 SeaweedFS
- **Purpose**: Distributed object storage system
- **Features**:
  - S3-compatible API
  - Distributed architecture
  - Automatic replication
  - Metadata management
  - High availability

## Networking Infrastructure

### 🌐 Cilium CNI
- **Namespace**: kube-system
- **Purpose**: Container networking and security
- **Features**:
  - eBPF-based networking
  - BGP load balancing
  - Network policies
  - Service mesh capabilities
  - Observability

**BGP Configuration**:
- **Cluster ASN**: 64514
- **Peer ASN**: 64513 (router)
- **Load Balancer IPs**: Automatic IP advertisement
- **Failover**: BGP convergence for high availability

### 🔗 External DNS
- **Purpose**: Automatic DNS record management
- **Provider**: Cloudflare DNS API
- **Features**:
  - Automatic A/CNAME record creation
  - Service discovery integration
  - Multi-provider support
  - Record lifecycle management

### 🌉 Ingress Controllers
**External Ingress (nginx)**:
- **Load Balancer IP**: 10.0.30.60
- **Purpose**: External traffic routing
- **TLS**: Automatic certificate injection
- **Authentication**: Authentik forward auth integration

**Internal Ingress (nginx)**:
- **Load Balancer IP**: 10.0.30.40
- **Purpose**: Internal traffic routing
- **Access Control**: Network-based restrictions
- **Performance**: Optimized for internal traffic

### 🚪 Gateway API
- **Purpose**: Next-generation traffic management
- **Features**:
  - Advanced routing capabilities
  - Traffic splitting
  - Header manipulation
  - Protocol support

## System Components

### 📊 Metrics Server
- **Purpose**: Kubernetes resource metrics
- **Features**:
  - CPU and memory metrics
  - Horizontal Pod Autoscaler support
  - Vertical Pod Autoscaler metrics
  - kubectl top integration

### 🔄 Reloader
- **Purpose**: Automatic application restarts
- **Trigger**: ConfigMap and Secret changes
- **Features**:
  - Annotation-based configuration
  - Selective reloading
  - Zero-downtime restarts
  - Logging and monitoring

### 📅 Descheduler
- **Purpose**: Pod rescheduling optimization
- **Features**:
  - Node utilization balancing
  - Policy-based rescheduling
  - Resource optimization
  - Cluster efficiency improvement

### 🔧 Intel Device Plugin
- **Purpose**: Intel GPU device management
- **Features**:
  - GPU resource allocation
  - Hardware acceleration
  - Device scheduling
  - Resource limits

### 🔍 Node Feature Discovery
- **Purpose**: Hardware feature detection
- **Features**:
  - CPU feature detection
  - Hardware capability discovery
  - Node labeling
  - Workload placement optimization

### 🔄 Generic Device Plugin
- **Purpose**: Custom device management
- **Features**:
  - Custom resource types
  - Device allocation
  - Resource counting
  - Hardware abstraction

## Container Image Management

### 🪞 Spegel
- **Purpose**: Container image registry mirroring
- **Features**:
  - Distributed image caching
  - Bandwidth optimization
  - Registry redundancy
  - Automatic synchronization

**Benefits**:
- **Reduced Bandwidth**: Local image caching
- **Improved Performance**: Faster image pulls
- **Reliability**: Registry failover capability
- **Cost Optimization**: Reduced external traffic

## Monitoring Integration

### Prometheus Metrics
**Infrastructure Metrics**:
- **Flux CD**: GitOps operation metrics
- **cert-manager**: Certificate status and renewal
- **External Secrets**: Secret synchronization status
- **VolSync**: Backup success and performance
- **Cilium**: Network performance and security

**Database Metrics**:
- **PostgreSQL**: Connection counts, query performance
- **Redis**: Memory usage, command statistics
- **Backup Status**: Backup success rates and timing

### Grafana Dashboards
**GitOps Monitoring**:
- **Flux Status**: Reconciliation status and timing
- **Deployment Health**: Application deployment success
- **Git Sync**: Repository synchronization status
- **Webhook Activity**: Webhook trigger frequency

**Storage Monitoring**:
- **Volume Usage**: PVC utilization across namespaces
- **Backup Status**: VolSync backup success and timing
- **Snapshot Health**: Volume snapshot creation and cleanup
- **Performance**: Storage I/O and latency metrics

## Security and Compliance

### Network Security
**Network Policies**:
- **Namespace Isolation**: Inter-namespace traffic control
- **Ingress Policies**: External traffic restrictions
- **Egress Policies**: Outbound traffic control
- **Default Deny**: Secure-by-default networking

**TLS Everywhere**:
- **Internal TLS**: Service-to-service encryption
- **External TLS**: Client-to-cluster encryption
- **Certificate Rotation**: Automatic certificate renewal
- **Protocol Security**: Modern TLS configurations

### Access Control
**RBAC Configuration**:
- **Service Accounts**: Application-specific permissions
- **Role Bindings**: Namespace-scoped access
- **Cluster Roles**: Cluster-wide permissions
- **Principle of Least Privilege**: Minimal required permissions

## Disaster Recovery

### Backup Strategy
**Configuration Backup**:
- **Git Repository**: Infrastructure as Code
- **Encrypted Secrets**: SOPS-encrypted sensitive data
- **Cluster State**: Regular cluster state exports
- **Documentation**: Comprehensive recovery procedures

**Data Backup**:
- **Database Backups**: Automated PostgreSQL backups
- **Volume Backups**: VolSync application data backups
- **Secret Backup**: External Secrets operator redundancy
- **Certificate Backup**: Certificate authority backup

### Recovery Procedures
**Cluster Recovery**:
1. **Bootstrap**: Talos cluster initialization
2. **Flux Deployment**: GitOps operator installation
3. **Secret Restoration**: External Secrets configuration
4. **Application Deployment**: Automatic application restoration
5. **Data Restoration**: Volume and database restoration

## Troubleshooting

### Common Issues
**GitOps Problems**:
- **Sync Failures**: Check Git repository access and webhooks
- **Deployment Failures**: Review Helm chart values and dependencies
- **Permission Issues**: Verify RBAC configurations
- **Resource Conflicts**: Check for resource name collisions

**Storage Issues**:
- **Volume Provisioning**: Check CSI driver status
- **Backup Failures**: Verify VolSync configuration and NAS connectivity
- **Snapshot Problems**: Check volume snapshot controller
- **Performance**: Monitor Ceph cluster health

**Certificate Problems**:
- **Issuance Failures**: Check Let's Encrypt rate limits
- **DNS Validation**: Verify Cloudflare API access
- **Renewal Issues**: Check certificate expiry and renewal logs
- **Trust Issues**: Verify certificate chain validity

### Diagnostic Commands
```bash
# Check Flux status
flux get sources git -A
flux get kustomizations -A
flux get helmreleases -A

# Check certificate status
kubectl get certificates -A
kubectl get certificaterequests -A

# Check storage status
kubectl get pv,pvc -A
kubectl get volumesnapshots -A

# Check network status
cilium status
kubectl get svc -A
```

---

**Last Updated**: 2025-07-16  
**Infrastructure Applications**: 15+ core services  
**Storage Classes**: 4 configured classes  
**Backup Coverage**: 20+ applications  
**GitOps Management**: Fully automated deployment