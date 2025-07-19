# Home Cluster Documentation

Welcome to the comprehensive documentation for the Kubernetes home cluster. This documentation covers everything from high-level architecture to specific operational procedures.

## Quick Start

- **New to the cluster?** Start with the [Getting Started Guide](guides/getting-started.md)
- **Need to access a service?** Check [Accessing Services](guides/accessing-services.md)
- **Having issues?** See [Troubleshooting](operations/troubleshooting.md)

## Documentation Structure

### 🏗️ Architecture
- [**Overview**](architecture/overview.md) - High-level cluster architecture and design decisions
- [**Networking**](architecture/networking.md) - Network topology, IP ranges, and routing
- [**Storage**](architecture/storage.md) - Storage systems (Ceph, NFS, TrueNAS)

### 📱 Applications
- [**Application Catalog**](applications/README.md) - Complete inventory of running applications
- [**Media Services**](applications/media/) - Plex, Sonarr, Radarr, and media management
- [**Monitoring**](applications/monitoring/) - Prometheus, Grafana, and observability
- [**Security**](applications/security/) - Authentik, LLDAP, and authentication
- [**Infrastructure**](applications/infrastructure/) - Core services and databases
- [**Default Namespace**](applications/default/) - Productivity and utility applications

### ⚙️ Operations
- [**Deployment**](operations/deployment.md) - How to deploy changes and new applications
- [**Troubleshooting**](operations/troubleshooting.md) - Common issues and solutions
- [**Maintenance**](operations/maintenance.md) - Routine maintenance procedures
- [**Backup & Restore**](operations/backup-restore.md) - Backup strategies and recovery procedures

### 🖥️ Hardware
- [**Inventory**](hardware/inventory.md) - Physical hardware specifications
- [**Networking**](hardware/networking.md) - Physical network setup and configuration

### 📖 Guides
- [**Getting Started**](guides/getting-started.md) - New user onboarding
- [**Accessing Services**](guides/accessing-services.md) - How to access cluster applications
- [**Development**](guides/development.md) - Development workflow and best practices

## Cluster Overview

This is a production-ready Kubernetes home cluster running on **Talos Linux** with **Flux CD** for GitOps. The cluster includes:

- **3 Control Plane Nodes**: Lenovo ThinkCentre M75q (lenovo1, lenovo2) + Dell OptiPlex 3080 (dell1)
- **Network**: 10.0.30.0/24 with BGP load balancing via Cilium
- **Storage**: Ceph RBD + CephFS for persistent storage, TrueNAS for media and backups
- **Applications**: 40+ applications covering media, monitoring, security, and productivity

## Key Features

- **GitOps**: All configuration managed via Git with Flux CD
- **High Availability**: Multi-node control plane with automatic failover
- **Smart Alerting**: N8N-powered intelligent notification routing with context-aware decisions
- **Automated Backups**: VolSync + CloudNative-PG for comprehensive backup strategy
- **External Access**: Cloudflare tunnels for secure external access
- **Monitoring**: Complete observability stack with Prometheus, Grafana, and Gatus
- **Security**: SSO via Authentik, LLDAP directory, and comprehensive RBAC

## Getting Help

- **Documentation Issues**: Create an issue in this repository
- **Cluster Issues**: Check [Troubleshooting](operations/troubleshooting.md) first
- **Application Issues**: See specific application documentation in [Applications](applications/)

## Recent Changes

- **Smart Alert Routing**: Deployed N8N-powered intelligent notification system integrating Alertmanager, Gatus, Discord, and Pushover with context-aware routing
- **Storage Migration**: Migrated to TrueNAS RAIDZ1 with 36TB capacity and NVMe L2ARC cache
- **Backup Implementation**: Deployed VolSync for application backups and CloudNative-PG for database backups
- **Monitoring Enhancement**: Complete observability with multi-source alert routing and daily analytics

---

**Last Updated**: 2025-07-19  
**Cluster Version**: Kubernetes 1.31.4 on Talos Linux 1.9.0