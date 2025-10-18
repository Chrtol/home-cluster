# Media Applications

Complete media automation stack providing content acquisition, management, and streaming capabilities.

## Core Services

### 🎬 Plex Media Server
- **URL**: [plex.example.com](https://plex.example.com)
- **Load Balancer IP**: 10.0.30.70 (dedicated)
- **Purpose**: Primary media streaming server
- **Features**:
  - Intel GPU hardware transcoding
  - 4K and HDR content support
  - Mobile and smart TV apps
  - User management and sharing
  - Metadata enhancement and artwork

**Storage Configuration**:
- **Media Library**: NFS mount from `nas.example.com`
- **Config Data**: Ceph RBD persistent volume
- **Transcoding**: RAM disk for temporary files

**Hardware Acceleration**:
- Intel GPU passthrough for transcoding
- Supports H.264, H.265, AV1 codecs
- Automatic quality optimization

### 📸 Immich Photo Management
- **URLs**: 
  - [photos.example.com](https://photos.example.com)
  - [immich.example.com](https://immich.example.com)
- **Purpose**: Self-hosted Google Photos alternative
- **Features**:
  - Machine learning for face recognition
  - Automatic photo organization
  - Mobile app with backup
  - Video support and transcoding
  - Advanced search capabilities

**ML Capabilities**:
- Intel GPU acceleration for ML processing
- Object detection and classification
- Face clustering and recognition
- Smart album generation

**Storage**:
- **Photo Storage**: NFS from TrueNAS
- **Database**: PostgreSQL via CloudNative-PG
- **Config**: Ceph RBD volume

## Content Acquisition Stack

### 📺 Sonarr (TV Shows)
- **URL**: [sonarr.example.com](https://sonarr.example.com)
- **Purpose**: TV series monitoring and acquisition
- **Features**:
  - Automatic episode downloading
  - Quality profile management
  - Calendar view of upcoming episodes
  - Integration with download clients
  - Subtitle management via Bazarr

### 🎭 Radarr (Movies)
- **URL**: [radarr.example.com](https://radarr.example.com)
- **Purpose**: Movie monitoring and acquisition
- **Features**:
  - Movie collection management
  - Quality and format preferences
  - Custom formats and scoring
  - Automatic upgrading
  - Integration with download clients

### 📚 Readarr (Books)
- **URL**: [readarr.example.com](https://readarr.example.com)
- **Purpose**: Book and audiobook management
- **Features**:
  - Author and series tracking
  - Multiple format support
  - Metadata enhancement
  - Integration with book download sources

### 🔍 Prowlarr (Indexers)
- **Purpose**: Centralized indexer management
- **Features**:
  - Unified indexer configuration
  - API integration with *arr applications
  - Search aggregation
  - Statistics and health monitoring

## Download Clients

### 🌊 qBittorrent
- **Purpose**: Primary BitTorrent client
- **Features**:
  - VPN integration via Gluetun
  - Category-based organization
  - Ratio management
  - Remote API access
  - RSS feed support

**VPN Configuration**:
- Gluetun sidecar for VPN connectivity
- Kill switch protection
- IP leak prevention
- Multiple VPN provider support

### 📰 SABnzbd
- **URL**: [sab.example.com](https://sab.example.com)
- **Purpose**: Usenet downloader
- **Features**:
  - Automated post-processing
  - Category-based handling
  - Repair and extraction
  - Speed limiting and scheduling

## Media Enhancement Tools

### 🎬 Bazarr (Subtitles)
- **Purpose**: Subtitle management and downloading
- **Features**:
  - Multi-language subtitle support
  - Automatic subtitle downloading
  - Quality scoring and providers
  - Integration with Sonarr/Radarr

### 📊 Tautulli (Plex Analytics)
- **Purpose**: Plex server monitoring and statistics
- **Features**:
  - User activity tracking
  - Bandwidth monitoring
  - Custom notifications
  - Historical analytics
  - Mobile app support

### 🔄 Recyclarr (Quality Management)
- **Purpose**: Automated quality profile management
- **Features**:
  - TRaSH guide synchronization
  - Custom format automation
  - Quality profile updates
  - Scoring optimization

## Automation Tools

### 🚀 Autobrr
- **Purpose**: Automated torrent management
- **Features**:
  - IRC announcer integration
  - Custom filtering rules
  - Cross-seeding automation
  - Release monitoring

### 🌱 Cross-seed
- **Purpose**: Cross-seeding automation
- **Features**:
  - Automatic torrent matching
  - Ratio optimization
  - Multiple tracker support
  - Bandwidth management

### 🧹 Cleanuparr
- **Purpose**: Media library cleanup
- **Features**:
  - Duplicate file detection
  - Quality-based cleanup
  - Automated file removal
  - Integration with *arr apps

### ☁️ FlareSolverr
- **Purpose**: CloudFlare bypass proxy
- **Features**:
  - Automated CAPTCHA solving
  - CloudFlare challenge handling
  - Proxy service for indexers
  - Rate limiting protection

## Request Management

### 🎫 Jellyseerr
- **URLs**:
  - [jellyseerr.example.com](https://jellyseerr.example.com)
  - [request.example.com](https://request.example.com)
- **Purpose**: Media request management interface
- **Features**:
  - User-friendly request interface
  - Plex user integration
  - Approval workflows
  - Request tracking and notifications
  - Discover trending content

**Integration**:
- Connects to Plex for user authentication
- Sends requests to Sonarr/Radarr
- Automated approval for trusted users
- Email/Discord notifications

### 🧙 Wizarr (User Management)
- **URLs**:
  - [join.example.com](https://join.example.com)
  - [wizarr.example.com](https://wizarr.example.com)
- **Purpose**: User invitation and onboarding
- **Features**:
  - Invitation link generation
  - User account creation
  - Plex server setup automation
  - Welcome messages and guides

## Audiobook Services

### 🎧 Audiobookshelf
- **Purpose**: Audiobook and podcast server
- **Features**:
  - Progressive web app
  - Chapter navigation
  - Playback speed control
  - Cross-device synchronization
  - Metadata management

### 📖 Audiobookrequest
- **Purpose**: Audiobook request management
- **Features**:
  - Request interface for audiobooks
  - Integration with acquisition tools
  - User notifications
  - Library management

### 📚 LazyLibrarian
- **Purpose**: Book management and automation
- **Features**:
  - Book monitoring and downloading
  - Author tracking
  - Magazine support
  - Quality management

### 👓 Reading Glasses
- **Purpose**: Reading progress tracking
- **Features**:
  - Book progress synchronization
  - Reading statistics
  - Goal tracking
  - Integration with book services

## Hunting and Discovery

### 🏹 Huntarr
- **Purpose**: Media hunting automation
- **Features**:
  - Automated content discovery
  - Release monitoring
  - Custom search criteria
  - Integration with acquisition stack

## Storage Architecture

### Primary Storage (NFS)
- **Source**: TrueNAS (`nas.example.com`)
- **Configuration**: RAIDZ1 with 36TB usable capacity
- **Performance**: 2.5GbE network, NVMe L2ARC cache
- **Content Types**:
  - Movies: `/mnt/nas/media/movies`
  - TV Shows: `/mnt/nas/media/tv`
  - Music: `/mnt/nas/media/music`
  - Books: `/mnt/nas/media/books`
  - Photos: `/mnt/nas/photos`

### Application Data (Ceph)
- **Configuration Storage**: Ceph RBD volumes
- **Database Storage**: PostgreSQL on Ceph
- **Temporary Storage**: RAM disks for transcoding

### Download Staging
- **Incomplete Downloads**: Local SSD storage
- **Processing**: High-speed temporary storage
- **Completed**: Automatic move to NAS

## Network Configuration

### Load Balancer IPs
- **Plex**: 10.0.30.70 (dedicated for optimal performance)
- **Other Media Apps**: Standard ingress (10.0.30.40/60)

### External Access
- **Cloudflare Tunnel**: Secure external access
- **Domain**: `*.example.com`
- **TLS**: Wildcard certificates via cert-manager

### VPN Integration
- **Download Protection**: Gluetun VPN for download clients
- **Kill Switch**: Automatic connection protection
- **DNS**: Custom DNS for VPN traffic

## Security and Authentication

### Access Control
- **External Apps**: Authentik SSO integration
- **Internal Apps**: Network-based access control
- **API Keys**: Secure API communication between services

### Download Security
- **VPN**: All download traffic through VPN
- **Isolation**: Network policies for download containers
- **Monitoring**: Traffic analysis and alerting

## Backup Strategy

### Application Configurations
- **VolSync**: Automated backups to NAS
- **Schedule**: Daily incremental backups
- **Retention**: 30-day retention policy

### Media Content
- **Primary**: RAIDZ1 provides single-disk failure protection
- **Offsite**: Critical content replicated to external storage
- **Database**: PostgreSQL automated backups via CloudNative-PG

### Disaster Recovery
- **Configuration Restore**: Automated via GitOps
- **Data Recovery**: Point-in-time restore capabilities
- **Testing**: Monthly backup verification

## Performance Optimization

### Hardware Acceleration
- **Intel GPU**: Shared between Plex and Immich
- **Transcoding**: Hardware-accelerated video processing
- **ML Processing**: GPU acceleration for photo analysis

### Network Optimization
- **Dedicated IPs**: Plex on dedicated load balancer IP
- **CDN**: Cloudflare for external traffic optimization
- **Bandwidth**: QoS policies for media streaming

### Storage Performance
- **NVMe Cache**: L2ARC cache on TrueNAS
- **Network**: 2.5GbE with planned 10GbE upgrade
- **RAID**: RAIDZ1 optimized for streaming workloads

## Monitoring and Alerting

### Application Health
- **Prometheus**: Metrics collection from all services
- **Grafana**: Custom dashboards for media stack
- **Gatus**: External health monitoring

### Performance Metrics
- **Transcoding**: GPU utilization and queue length
- **Download Speed**: Bandwidth utilization tracking
- **Storage**: Disk usage and performance metrics

### Alerting
- **Service Down**: Immediate notifications
- **Storage Full**: Proactive capacity alerts
- **Failed Downloads**: Automated retry and notification

## Troubleshooting

### Common Issues
- **Transcoding Problems**: Check Intel GPU availability
- **Download Failures**: Verify VPN connectivity
- **Storage Issues**: Check NFS mount and permissions
- **Authentication**: Verify Authentik SSO configuration

### Log Access
- **Centralized Logging**: All applications log to stdout
- **Kubernetes Logs**: `kubectl logs` for troubleshooting
- **Application Logs**: Web interface log access

### Performance Issues
- **Resource Limits**: Check CPU/memory constraints
- **Network Bandwidth**: Monitor network utilization
- **Storage Latency**: Check NAS performance

---

**Last Updated**: 2025-07-16  
**Media Applications**: 20+ services  
**Storage Capacity**: 36TB usable  
**External Access**: 8 public endpoints