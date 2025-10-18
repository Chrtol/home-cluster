# Application Catalog

## Overview

The home cluster hosts **40+ applications** across **7 namespaces**, providing a comprehensive suite of services for media management, home automation, productivity, and infrastructure management. All applications are deployed using GitOps principles with Flux CD.

## Quick Access Dashboard

| Application | URL | Purpose | Status |
|-------------|-----|---------|--------|
| **Homepage** | [homepage.example.com](https://homepage.example.com) | Personal dashboard | 🟢 |
| **Plex** | [plex.example.com](https://plex.example.com) | Media server | 🟢 |
| **Immich** | [photos.example.com](https://photos.example.com) | Photo management | 🟢 |
| **Jellyseerr** | [request.example.com](https://request.example.com) | Media requests | 🟢 |
| **Home Assistant** | [hass.example.com](https://hass.example.com) | Home automation | 🟢 |
| **Grafana** | [grafana.example.com](https://grafana.example.com) | Monitoring | 🟢 |
| **Authentik** | [sso.example.com](https://sso.example.com) | Single sign-on | 🟢 |
| **Wizarr** | [join.example.com](https://join.example.com) | User invitations | 🟢 |

## Application Categories

### 🏠 [Default Namespace](default/)
**Home and Productivity Applications**
- **Home Assistant**: Smart home automation platform
- **Homepage**: Kubernetes-native dashboard with monitoring widgets
- **Mealie**: Recipe management and meal planning
- **Actual Budget**: Personal finance and budgeting
- **Joplin**: Note-taking and synchronization server
- **Affine**: Collaborative workspace (Notion alternative)
- **IT-Tools**: Collection of developer and admin utilities

### 🎬 [Media Services](media/)
**Entertainment and Content Management**
- **Plex**: Media streaming server with hardware transcoding
- **Sonarr**: TV series management and automation
- **Radarr**: Movie management and automation
- **Jellyseerr**: Media request management interface
- **qBittorrent**: BitTorrent client with VPN protection
- **Immich**: Self-hosted photo management with AI
- **Audiobookshelf**: Audiobook server and manager

### 🔐 [Security](security/)
**Authentication and Authorization**
- **Authentik**: Identity provider and SSO solution
- **LLDAP**: Lightweight LDAP server for user management

### 📊 [Monitoring](monitoring/)
**Observability and Alerting**
- **Prometheus**: Metrics collection and storage
- **Grafana**: Metrics visualization and dashboarding
- **Gatus**: Uptime monitoring and status page
- **AlertManager**: Alert routing and notifications

### 🗄️ [Infrastructure](infrastructure/)
**Core Services and Databases**
- **PostgreSQL**: Main database cluster (v17)
- **Dragonfly**: High-performance Redis-compatible cache
- **SeaweedFS**: Distributed object storage
- **Flux CD**: GitOps deployment management
- **Cert-Manager**: TLS certificate automation

## Access Methods

### External Access (`*.example.com`)
Applications accessible from the internet via Cloudflare tunnel:
- **Plex**: `plex.example.com`
- **Jellyseerr**: `request.example.com`
- **Home Assistant**: `hass.example.com`
- **Immich**: `photos.example.com`
- **Authentik**: `sso.example.com`

### Internal Access (`*.home.arpa`)
Applications accessible only from internal network:
- **Homepage**: Dashboard and monitoring
- **Sonarr/Radarr**: Media management
- **Grafana**: Metrics and dashboards
- **qBittorrent**: Download management

## Authentication Integration

### Single Sign-On (SSO)
Most external applications use **Authentik** for authentication:
- SAML/OAuth2/OIDC provider
- Forward auth for nginx ingress
- Multi-factor authentication support
- User lifecycle management

### Access Control
- **External Apps**: Authentik forward auth required
- **Internal Apps**: IP-based access control (10.0.0.0/8)
- **Admin Tools**: Additional authentication layers

## Storage Usage

### Application Data
- **Ceph RBD**: High-performance storage for databases and config
- **Ceph CephFS**: Shared storage for multi-pod applications
- **NFS**: Media files and large data sets

### Backup Coverage
Applications with automated backups via VolSync:
- Home Assistant, Plex, Sonarr, Radarr
- Affine, Audiobookshelf, Jellyseerr
- PostgreSQL databases via CloudNative-PG

## Resource Allocation

### High-Resource Applications
- **Plex**: 1-2.5 CPU, up to 10Gi RAM (transcoding)
- **Immich**: Intel GPU for ML processing
- **Prometheus**: 50Gi storage, 14-day retention

### GPU Utilization
- **Intel GPU**: Shared between Plex (transcoding) and Immich (ML)
- **Hardware Acceleration**: Enabled for video processing

## Networking

### Load Balancer IPs
- **Internal Ingress**: 10.0.30.40
- **External Ingress**: 10.0.30.60
- **DNS Gateway**: 10.0.30.45
- **Plex Direct**: 10.0.30.70

### Service Discovery
- **Internal DNS**: k8s_gateway for service resolution
- **External DNS**: Cloudflare automation for public records
- **Split DNS**: Internal routing for home network

## Deployment Statistics

### By Category
- **Media Applications**: 15+ applications
- **Productivity/Home**: 10+ applications
- **Infrastructure**: 15+ core services
- **Monitoring**: 5+ observability tools
- **Security**: 2 authentication services

### Update Management
- **Renovate**: Automated dependency updates
- **Flux**: GitOps continuous deployment
- **Version Tracking**: Semantic versioning across all apps

## Getting Started

### For New Users
1. Access **Homepage** for service overview
2. Use **Authentik** for SSO account setup
3. Request media via **Jellyseerr**
4. Monitor system via **Grafana** dashboards

### For Administrators
1. Check **Flux** status for deployment health
2. Monitor via **Prometheus/Grafana** stack
3. Manage users via **Authentik/LLDAP**
4. Review backups via **VolSync** status

## Application Documentation

Detailed documentation for each application category:

- [**Default Namespace**](default/) - Home and productivity applications
- [**Media Services**](media/) - Entertainment and content management
- [**Security**](security/) - Authentication and authorization
- [**Monitoring**](monitoring/) - Observability and alerting
- [**Infrastructure**](infrastructure/) - Core services and databases

---

**Last Updated**: 2025-07-16  
**Total Applications**: 50+  
**Namespaces**: 8  
**External Services**: 10+  
**Internal Services**: 40+