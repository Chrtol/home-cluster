# Architecture Overview

## High-Level Architecture

The home cluster is built on a foundation of modern Kubernetes technologies designed for reliability, scalability, and ease of management. The architecture follows cloud-native principles while being optimized for a home environment.

## Core Components

### Operating System & Kubernetes
- **OS**: Talos Linux v1.9.0 - Immutable, secure, and purpose-built for Kubernetes
- **Kubernetes**: v1.31.4 - Latest stable release with security patches
- **Control Plane**: 3-node highly available setup with etcd
- **Worker Nodes**: All nodes configured as both controllers and workers

### GitOps & Configuration Management
- **GitOps**: Flux CD v2 for continuous deployment and configuration management
- **Configuration**: Declarative infrastructure as code using Kustomize
- **Secrets**: External Secrets Operator with OnePassword integration
- **Templates**: Makejinja for configuration templating from cluster.yaml/nodes.yaml

### Networking
- **CNI**: Cilium with eBPF for high-performance networking
- **Load Balancing**: BGP-based load balancing with automatic failover
- **Ingress**: Dual ingress controllers (internal/external) with nginx
- **DNS**: CoreDNS with k8s_gateway for internal service discovery
- **External Access**: Cloudflare tunnels for secure external connectivity

### Storage
- **Primary**: Ceph cluster with RBD (block) and CephFS (shared filesystem)
- **Secondary**: NFS from TrueNAS for media storage and backups
- **Snapshots**: Volume snapshots for backup and disaster recovery

### Security
- **Authentication**: Authentik for SSO and identity management
- **Directory**: LLDAP for lightweight LDAP directory services
- **Secrets**: SOPS with age encryption for GitOps secrets
- **Certificates**: cert-manager with Let's Encrypt for TLS automation

### Observability
- **Metrics**: Prometheus with comprehensive service monitoring
- **Visualization**: Grafana with custom dashboards
- **Logging**: Centralized logging with structured log aggregation
- **Alerting**: Prometheus AlertManager with multiple notification channels

## Design Principles

### High Availability
- **No Single Points of Failure**: 3-node control plane with automatic failover
- **Distributed Storage**: Ceph provides redundant storage across nodes
- **Load Balancing**: BGP ensures traffic distribution and fault tolerance
- **Backup Strategy**: Comprehensive backup of both applications and databases

### Automation
- **GitOps**: All changes tracked in Git with automatic reconciliation
- **Continuous Deployment**: Flux ensures cluster state matches Git repository
- **Dependency Management**: Renovate automates dependency updates
- **Configuration Management**: Template-based configuration for consistency

### Security
- **Immutable Infrastructure**: Talos provides read-only root filesystem
- **Encryption**: All secrets encrypted at rest and in transit
- **Network Security**: Pod security policies and network policies
- **Access Control**: RBAC with principle of least privilege

### Scalability
- **Horizontal Scaling**: Applications designed for horizontal pod autoscaling
- **Resource Management**: Proper resource requests and limits
- **Storage Expansion**: Ceph allows easy storage expansion
- **Node Addition**: Template-based node configuration for easy expansion

## Data Flow

### Application Deployment
1. **Configuration Change**: Developer commits changes to Git repository
2. **Webhook Trigger**: GitHub webhook triggers immediate Flux reconciliation
3. **Flux Sync**: Flux detects changes and applies them to cluster
4. **Helm/Kustomize**: Applications deployed via Helm charts or Kustomize
5. **Health Checks**: Flux monitors deployment health and reports status

### Traffic Flow
1. **External Request**: Client connects via Cloudflare tunnel
2. **Load Balancer**: Cilium BGP directs traffic to appropriate node
3. **Ingress Controller**: nginx-ingress routes to appropriate service
4. **Service Mesh**: Kubernetes service discovery and load balancing
5. **Pod Network**: Cilium provides pod-to-pod communication

### Storage Access
1. **Application Request**: Pod requests persistent storage
2. **CSI Driver**: Ceph CSI driver provisions storage
3. **Ceph Cluster**: Distributed storage across multiple nodes
4. **Backup**: VolSync creates scheduled backups to NAS

## Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                          External Access                        │
├─────────────────────────────────────────────────────────────────┤
│  Cloudflare Tunnel → External Ingress (10.0.30.60)            │
│  Internal Network → Internal Ingress (10.0.30.40)             │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                      Load Balancing & Routing                   │
├─────────────────────────────────────────────────────────────────┤
│  Cilium BGP (AS 64514) ↔ Router (AS 64513)                    │
│  k8s_gateway DNS (10.0.30.45)                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                     Kubernetes Control Plane                    │
├─────────────────────────────────────────────────────────────────┤
│  API Server (10.0.30.50) - HA across 3 nodes                  │
│  etcd - Distributed key-value store                             │
│  Flux CD - GitOps continuous deployment                         │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                        Worker Nodes                             │
├─────────────────────────────────────────────────────────────────┤
│  lenovo1 (10.0.30.100) - Controller + Worker                   │
│  lenovo2 (10.0.30.101) - Controller + Worker                   │
│  dell1 (10.0.30.102) - Controller + Worker                     │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                      Storage & Persistence                      │
├─────────────────────────────────────────────────────────────────┤
│  Ceph RBD - Block storage for applications                      │
│  CephFS - Shared filesystem storage                             │
│  TrueNAS - NFS for media and backups                           │
└─────────────────────────────────────────────────────────────────┘
```

## Resource Allocation

### Per-Node Resources
- **CPU**: Intel processors with adequate cores for workloads
- **Memory**: Sufficient RAM for Kubernetes overhead and applications
- **Storage**: Local SSD for OS and Ceph OSD storage
- **Network**: Gigabit Ethernet with BGP capability

### Cluster Resources
- **Total Nodes**: 3 (all controller + worker)
- **High Availability**: N+1 redundancy for critical components
- **Storage**: Distributed across nodes with replication
- **Network**: Mesh networking with BGP load balancing

## Future Expansion

### Planned Enhancements
- **Hardware**: Additional nodes for increased capacity
- **Storage**: Expanded Ceph cluster for more storage
- **Networking**: Enhanced networking with additional VLANs
- **Applications**: Additional services and workloads

### Scalability Considerations
- **Node Addition**: Template-based configuration for easy expansion
- **Storage Growth**: Ceph designed for horizontal scaling
- **Application Scaling**: HPA and VPA for automatic scaling
- **Network Capacity**: BGP supports additional nodes seamlessly

---

**Last Updated**: 2025-07-16  
**Architecture Version**: v2.0 (Post-TrueNAS migration)  
**Next Review**: 2025-10-16