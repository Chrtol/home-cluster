# Default Namespace Applications

Personal productivity, home automation, and utility applications for daily use.

## Home Automation

### 🏠 Home Assistant
- **URL**: [hass.example.com](https://hass.example.com)
- **Purpose**: Smart home automation platform
- **Features**:
  - Device integration and control
  - Automation and scenes
  - Energy monitoring
  - Mobile app with notifications
  - Voice assistant integration

**Integrations**:
- Zigbee devices via Zigbee2MQTT
- MQTT broker (Mosquitto)
- Weather services
- Security cameras
- Smart switches and sensors

**Storage**:
- **Config**: Ceph RBD persistent volume
- **Database**: SQLite for historical data
- **Backups**: VolSync to NAS

### 🦟 Mosquitto MQTT Broker
- **Purpose**: IoT message broker for Home Assistant
- **Features**:
  - Lightweight MQTT broker
  - Authentication and ACLs
  - Retained messages
  - QoS support
  - WebSocket support

### 📡 Zigbee Integration
- **Purpose**: Zigbee device management
- **Features**:
  - Device pairing and management
  - Network topology visualization
  - Firmware updates
  - Device configuration

## Personal Dashboard

### 🏠 Homepage
- **URL**: [homepage.example.com](https://homepage.example.com)
- **Purpose**: Kubernetes-native personal dashboard
- **Features**:
  - Service status monitoring
  - Resource utilization widgets
  - Custom bookmarks and links
  - Weather information
  - Calendar integration

**Widgets**:
- Kubernetes cluster status
- Application health checks
- System resource usage
- Weather forecast
- Calendar events

### 🚀 Hajimari
- **Purpose**: Application launcher and bookmark manager
- **Features**:
  - Clean, minimal interface
  - Custom application groups
  - Search functionality
  - Keyboard shortcuts
  - Theme customization

### 👀 Glance
- **Purpose**: At-a-glance information dashboard
- **Features**:
  - RSS feed aggregation
  - Weather display
  - Calendar integration
  - System monitoring
  - Custom widgets

## Productivity Applications

### 🍳 Mealie
- **Purpose**: Recipe management and meal planning
- **Features**:
  - Recipe import from URLs
  - Meal planning calendar
  - Shopping list generation
  - Nutritional information
  - Recipe sharing

**Storage**:
- **Database**: PostgreSQL
- **Media**: Recipe images and attachments
- **Backups**: VolSync integration

### 💰 Actual Budget
- **Purpose**: Personal finance and budgeting
- **Features**:
  - Bank synchronization
  - Category-based budgeting
  - Transaction tracking
  - Reports and analytics
  - Multi-device sync

**Security**:
- **Encryption**: End-to-end encrypted data
- **Authentication**: Local user management
- **Backups**: Encrypted backup files

### 📝 Joplin
- **Purpose**: Note-taking and synchronization server
- **Features**:
  - Markdown note editing
  - Cross-device synchronization
  - End-to-end encryption
  - Web clipper integration
  - Plugin support

**Storage**:
- **Notes**: PostgreSQL database
- **Attachments**: File storage on Ceph
- **Sync**: Real-time synchronization

### 🧠 Affine
- **Purpose**: Collaborative workspace (Notion alternative)
- **Features**:
  - Block-based editing
  - Real-time collaboration
  - Templates and databases
  - File attachments
  - Version history

**Capabilities**:
- **Documents**: Rich text editing with blocks
- **Databases**: Structured data management
- **Collaboration**: Multi-user editing
- **Import/Export**: Notion import support

### 🔖 Karakeep
- **Purpose**: Bookmark management and organization
- **Features**:
  - URL bookmark storage
  - Tag-based organization
  - Full-text search
  - Import/export functionality
  - API access

### 🍽️ KitchenOwl
- **Purpose**: Kitchen inventory and shopping management
- **Features**:
  - Pantry inventory tracking
  - Shopping list management
  - Recipe integration
  - Expiration date tracking
  - Barcode scanning

## Utility Applications

### 📄 Stirling PDF
- **Purpose**: PDF manipulation and processing tools
- **Features**:
  - PDF merge and split
  - Format conversion
  - OCR text extraction
  - Digital signature
  - Watermarking

**Privacy**:
- **Local Processing**: All operations performed locally
- **No Data Retention**: Files not stored after processing
- **Secure**: No external API calls

### 🛠️ IT-Tools
- **Purpose**: Collection of developer and admin utilities
- **Features**:
  - Base64 encoding/decoding
  - JSON formatting and validation
  - Hash generation and verification
  - UUID generation
  - Color palette tools

**Tool Categories**:
- **Text**: Formatters, converters, validators
- **Crypto**: Hash functions, encryption tools
- **Network**: IP calculators, port scanners
- **Development**: Code formatters, generators

### 📤 Pingvin Share
- **Purpose**: Temporary file sharing service
- **Features**:
  - Secure file uploads
  - Expiration date settings
  - Password protection
  - Download tracking
  - API access

**Security**:
- **Encryption**: File encryption at rest
- **Access Control**: Password and expiration protection
- **Privacy**: Automatic file deletion

### 🔄 OpenFlow
- **Purpose**: Workflow automation and integration
- **Features**:
  - Visual workflow designer
  - API integrations
  - Data transformation
  - Scheduled execution
  - Conditional logic

### 📢 Apprise
- **Purpose**: Notification service aggregator
- **Features**:
  - Multi-platform notifications
  - Discord, Slack, email integration
  - Custom notification formats
  - API endpoint for services
  - Message queuing

**Integrations**:
- **Chat**: Discord, Slack, Teams
- **Email**: SMTP, Gmail, Office365
- **Mobile**: Pushover, Telegram
- **Custom**: Webhook endpoints

### 🔊 Echo Service
- **Purpose**: Simple echo service for testing
- **Features**:
  - HTTP request/response testing
  - Header inspection
  - Payload echo
  - Health check endpoint
  - Development debugging

## Network Configuration

### Internal Access
- **Load Balancer**: 10.0.30.40 (internal ingress)
- **Domain Pattern**: `{app}.example.com`
- **Access Control**: Internal network only (10.0.0.0/8)

### External Access
Applications accessible from internet via Cloudflare tunnel:
- **Home Assistant**: Smart home management
- **Homepage**: Personal dashboard
- **Mealie**: Recipe access on mobile
- **Actual**: Budget access anywhere

### Authentication
- **Home Assistant**: Built-in user management
- **Other Apps**: Network-based access control
- **API Access**: Application-specific API keys

## Storage Architecture

### Application Data
- **Configuration**: Ceph RBD persistent volumes
- **Databases**: PostgreSQL via CloudNative-PG
- **File Storage**: Ceph CephFS for shared data

### Backup Strategy
- **VolSync**: Automated application backups
- **Database**: PostgreSQL automated backups
- **Schedule**: Daily incremental backups
- **Retention**: 30-day backup retention

## Resource Allocation

### High-Resource Applications
- **Home Assistant**: 500m CPU, 1Gi RAM
- **Affine**: 200m CPU, 512Mi RAM
- **Joplin**: 100m CPU, 256Mi RAM

### Low-Resource Applications
- **IT-Tools**: 50m CPU, 128Mi RAM
- **Echo**: 10m CPU, 32Mi RAM
- **Pingvin**: 100m CPU, 256Mi RAM

### Storage Requirements
- **Home Assistant**: 5Gi persistent storage
- **Affine**: 2Gi persistent storage
- **Joplin**: 1Gi persistent storage

## Security Considerations

### Network Security
- **Internal Network**: Most apps accessible only internally
- **External Access**: Limited to essential services
- **TLS**: All traffic encrypted with Let's Encrypt certificates

### Data Privacy
- **Local Processing**: PDF tools and utilities process locally
- **No Telemetry**: Self-hosted alternatives to cloud services
- **Encryption**: Sensitive data encrypted at rest

### Access Control
- **Home Assistant**: Multi-factor authentication support
- **Network Isolation**: Pod-to-pod communication restrictions
- **API Security**: Rate limiting and authentication

## Integration Patterns

### Home Assistant Ecosystem
- **MQTT**: Device communication via Mosquitto
- **Zigbee**: Direct device integration
- **Notifications**: Apprise for external notifications
- **Dashboard**: Homepage widgets for status

### Productivity Workflow
- **Notes**: Joplin for documentation and planning
- **Recipes**: Mealie for meal planning
- **Budget**: Actual for expense tracking
- **Kitchen**: KitchenOwl for inventory

### Development Tools
- **IT-Tools**: Quick utilities and converters
- **Echo**: API testing and debugging
- **File Sharing**: Pingvin for temporary shares
- **Workflows**: OpenFlow for automation

## Monitoring and Health

### Application Health
- **Prometheus**: Metrics collection from all services
- **Grafana**: Custom dashboards for default namespace
- **Gatus**: External health monitoring

### Performance Metrics
- **Resource Usage**: CPU and memory utilization
- **Response Times**: Application performance monitoring
- **Storage Usage**: Persistent volume monitoring

### Alerting
- **Service Down**: Immediate notifications via Apprise
- **High Resource Usage**: Proactive capacity alerts
- **Backup Failures**: Automated backup monitoring

## Troubleshooting

### Common Issues
- **Home Assistant**: Check device connectivity and MQTT
- **Database Apps**: Verify PostgreSQL connectivity
- **Storage**: Check Ceph volume mounts
- **Network**: Verify ingress and DNS resolution

### Log Access
- **Application Logs**: Kubernetes stdout logs
- **Home Assistant**: Built-in log viewer
- **Database**: PostgreSQL logs via CloudNative-PG

### Performance Issues
- **Resource Limits**: Check CPU/memory constraints
- **Database Performance**: Monitor PostgreSQL metrics
- **Storage Latency**: Check Ceph cluster health

---

**Last Updated**: 2025-07-16  
**Default Applications**: 15+ services  
**External Access**: 4 public endpoints  
**Internal Services**: 11+ internal tools