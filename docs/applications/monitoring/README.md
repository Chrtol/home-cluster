# Monitoring Applications

Complete observability stack for cluster monitoring, alerting, and performance analysis.

## Core Monitoring Stack

### 📊 Prometheus
- **Purpose**: Metrics collection and time-series database
- **Namespace**: observability
- **Role**: Core metrics collection engine

**Key Features**:
- **Metrics Collection**: Pull-based metrics scraping
- **Time Series Database**: High-performance metric storage
- **PromQL**: Powerful query language for metrics analysis
- **Service Discovery**: Automatic target discovery
- **Alerting**: Rule-based alert generation

**Data Retention**:
- **Storage**: 50Gi persistent volume on Ceph
- **Retention Period**: 14 days of metrics data
- **Compression**: Efficient time-series compression
- **Backup**: VolSync backups to NAS

**Scrape Targets**:
- **Kubernetes Metrics**: kubelet, kube-state-metrics, node-exporter
- **Application Metrics**: All applications with /metrics endpoints
- **Infrastructure**: Ceph cluster, TrueNAS, network equipment
- **Custom Exporters**: Specialized metric collectors

### 📈 Grafana
- **URL**: [grafana.example.com](https://grafana.example.com)
- **Purpose**: Metrics visualization and dashboarding platform
- **Authentication**: Authentik SSO integration

**Core Features**:
- **Dashboard Creation**: Rich visualization interface
- **Data Sources**: Prometheus, Loki, external databases
- **Alerting**: Visual alert management
- **User Management**: Role-based access control
- **Plugin Ecosystem**: Extensive plugin library

**Data Sources**:
- **Prometheus**: Primary metrics source
- **Loki**: Log aggregation (when available)
- **PostgreSQL**: Application database metrics
- **External APIs**: Weather, external services

**Dashboard Categories**:
- **Kubernetes**: Cluster and workload monitoring
- **Infrastructure**: Hardware and storage monitoring
- **Applications**: Service-specific dashboards
- **Business**: Application usage and performance

### 🚦 Gatus
- **Purpose**: Service health monitoring and status page
- **Features**:
  - HTTP/HTTPS endpoint monitoring
  - DNS resolution checks
  - TCP port availability
  - Response time tracking
  - Custom health check conditions

**Monitoring Scope**:
- **External Services**: Internet-facing applications
- **Internal Services**: Critical cluster applications
- **Infrastructure**: Network and storage health
- **Third-party**: External dependencies

## Dashboard Library

### Kubernetes Dashboards
**Cluster Overview**:
- **Node Status**: CPU, memory, disk usage per node
- **Pod Statistics**: Running, pending, failed pods
- **Resource Utilization**: Cluster-wide resource consumption
- **Network Traffic**: Ingress/egress bandwidth monitoring

**Workload Monitoring**:
- **Deployment Health**: Replica status and rollout progress
- **Service Mesh**: Pod-to-pod communication metrics
- **Storage**: PVC usage and performance
- **Events**: Kubernetes event timeline

**Node-Level Metrics**:
- **System Resources**: CPU, memory, disk I/O
- **Network Interfaces**: Interface statistics and errors
- **Kernel Metrics**: System call rates and context switches
- **Hardware**: Temperature and power consumption

### Infrastructure Dashboards
**Ceph Storage**:
- **Cluster Health**: OSD status and cluster state
- **Performance**: IOPS, throughput, latency metrics
- **Capacity**: Used/available storage across pools
- **Recovery**: Data recovery and rebalancing status

**TrueNAS Monitoring**:
- **System Metrics**: CPU, memory, network utilization
- **Storage Pools**: RAIDZ1 health and performance
- **Network**: 2.5GbE interface statistics
- **Temperature**: Drive and system temperature monitoring

**Network Infrastructure**:
- **BGP Status**: Peering status and route advertisement
- **Load Balancer**: Service IP allocation and traffic
- **DNS**: Query rates and response times
- **Ingress Controllers**: Request rates and error codes

### Application Dashboards
**Media Stack**:
- **Plex**: Active streams, transcoding sessions, bandwidth
- **Download Clients**: qBittorrent, SABnzbd download rates
- **Storage Usage**: Media library growth and capacity
- **Transcoding**: Intel GPU utilization and queue length

**Database Monitoring**:
- **PostgreSQL**: Connection count, query performance, locks
- **Redis/Dragonfly**: Memory usage, hit rates, key statistics
- **Backup Status**: Database backup success/failure rates
- **Replication**: Primary/replica lag and status

**Home Automation**:
- **Home Assistant**: Entity count, automation execution
- **MQTT**: Message rates and broker performance
- **Zigbee**: Device connectivity and mesh health
- **Energy**: Power consumption and cost tracking

**Security Monitoring**:
- **Authentik**: Authentication rates, failed logins
- **Certificate Manager**: Certificate expiry tracking
- **Network Policies**: Traffic allowed/denied
- **Audit Events**: Security-relevant system events

## Smart Alert Routing System

### Architecture Overview
**Intelligent multi-source alert routing** powered by N8N with context-aware decision making:

**Input Sources**:
- **Alertmanager**: Infrastructure and application alerts from Prometheus
- **Gatus**: Service availability monitoring and health checks

**Smart Routing Engine (N8N)**:
- **Context Analysis**: Python-based intelligent routing decisions
- **Time-aware**: Day/night/weekend scheduling logic
- **Service categorization**: Infrastructure/media/network/backup classification
- **Source detection**: Different logic for Alertmanager vs Gatus alerts

**Output Channels**:
- **Discord Admin**: Immediate technical alerts with rich context
- **Discord Summary**: Daily analytics and trend reports  
- **Pushover**: Mobile notifications for critical alerts and escalation
- **Silent Logging**: Complete audit trail and analytics

### Alert Categories and Routing

**Critical Infrastructure Alerts**:
- **Triggers**: Node failure, Kubernetes core component down, storage critical
- **Routing**: Discord + Pushover + Silent log
- **Example**: "Critical infrastructure alert - immediate attention required"

**Network and Service Alerts**:
- **Triggers**: BGP down, ingress controller failure, DNS issues
- **Routing**: Discord + Pushover (if critical) + Silent log
- **Time-sensitive**: Standard routing during day, escalated at night

**Media and Application Alerts**:
- **Triggers**: Plex down, media service failures, application crashes
- **Routing**: Discord + Silent log (+ Pushover if during off-hours)
- **Context**: Different handling for entertainment vs business hours

**Backup and Storage Warnings**:
- **Triggers**: VolSync failures, storage capacity warnings, backup job issues
- **Routing**: Critical → Discord + Pushover, Warning → Silent log only
- **Time-based**: Non-critical backup alerts silent during night hours

**Gatus Service Monitoring**:
- **Triggers**: HTTP endpoint down, DNS resolution failure, connectivity issues
- **Routing**: Service down → Discord + Pushover, Recovery → Discord + Silent log
- **Escalation**: Critical mobile alerts for service outages during sleep hours

### Smart Routing Logic

**Time-Based Routing**:
- **Night Hours** (22:00-07:00): Only critical alerts to Pushover (wake up alerts)
- **Business Hours** (09:00-17:00): Standard Discord + context-aware Pushover
- **Weekends**: Standard routing with no special business hour considerations

**Severity-Based Escalation**:
- **Critical + Infrastructure**: Discord + Pushover + Silent log
- **Critical + Night**: Pushover critical (high priority) + Discord + Silent log  
- **Warning + Day**: Discord + Silent log
- **Warning + Night**: Silent log only (unless service down)

**Service Category Logic**:
```python
# Infrastructure: observability, kube-system, flux-system, ceph-csi-rbd
# Media: media namespace, plex/jellyfin services  
# Network: network, cilium-system namespaces
# Backup: volsync, backup-related alerts
# Gatus: all service monitoring alerts
```

**Source-Specific Handling**:
- **Alertmanager alerts**: Full infrastructure routing logic
- **Gatus alerts**: Service-focused routing with immediate escalation for outages

### Notification Channels

**Discord Admin Channel**:
- **Purpose**: Immediate technical alerts with rich context
- **Format**: Structured embeds with severity, namespace, routing reason
- **Content**: Alert name, description, affected service, troubleshooting context
- **Response**: Real-time notifications for active monitoring

**Discord Summary Channel**:  
- **Schedule**: Daily at 8:00 AM
- **Content**: 24-hour alert analysis, trending, system health assessment
- **Analytics**: Alert volume, top namespaces, pattern insights, performance metrics
- **Format**: Rich embeds with charts and actionable insights

**Pushover Mobile Notifications**:
- **Critical Infrastructure**: High priority with immediate delivery
- **Service Outages**: Standard priority with retry logic  
- **Night Escalation**: Critical priority to ensure delivery during sleep
- **Integration**: Dedicated Alertmanager Pushover app for infrastructure alerts

**Silent Logging and Analytics**:
- **Storage**: JSON Lines format in `/home/node/.n8n/alert_logs.jsonl`
- **Data**: Complete alert lifecycle, routing decisions, resolution tracking
- **Analytics**: Historical trending, pattern recognition, performance analysis
- **Retention**: Automatic cleanup after daily summary processing

### AlertManager Integration

**Configuration**:
```yaml
# All alerts route to N8N smart routing system
receivers:
  - name: n8n-smart-routing
    webhookConfigs:
      - url: "https://n8n-webhook.example.com/webhook/alerts"
        sendResolved: true
```

**Routing Rules**:
- **All Severities**: Warning and critical alerts route to N8N
- **No Direct Pushover**: All Pushover notifications handled by N8N logic
- **Resolved Alerts**: Alert resolution tracked for lifecycle management
- **Grouping**: Maintained for related alert consolidation

### Gatus Integration

**Configuration**:
```yaml
# Service monitoring with webhook integration
alerting:
  webhook:
    url: https://n8n-webhook.example.com/webhook/gatus
    default-alert:
      send-on-resolved: true
```

**Service Health Monitoring**:
- **HTTP Endpoints**: Application availability and response time
- **DNS Checks**: Domain resolution and propagation  
- **TCP Connectivity**: Port availability and network health
- **Custom Conditions**: Service-specific health validation

**Alert Lifecycle**:
- **Service Down**: Immediate notification with escalation logic
- **Service Recovery**: Confirmation notification with resolution tracking
- **Flapping Detection**: Smart handling of intermittent service issues
- **Maintenance Mode**: Automatic silencing during planned maintenance

### Alert Analytics and Reporting

**Daily Summary Analytics**:
- **Volume Analysis**: Total alerts by severity and time distribution
- **Service Health**: Top affected namespaces and service categories  
- **Pattern Recognition**: Recurring issues and trending problems
- **Performance Metrics**: Average resolution time and escalation frequency

**Historical Tracking**:
- **Alert Patterns**: Weekly and monthly trending analysis
- **Service Reliability**: Uptime tracking and SLA monitoring
- **Infrastructure Health**: Long-term capacity and performance trends
- **Improvement Metrics**: False positive reduction and tuning effectiveness

**Operational Intelligence**:
- **Peak Times**: Alert volume correlation with system load
- **Failure Correlation**: Cross-service impact analysis  
- **Escalation Patterns**: Night vs day alert handling effectiveness
- **Response Optimization**: Channel effectiveness and delivery success rates

## Performance Monitoring

### Resource Tracking
**Cluster Resources**:
- **CPU Utilization**: Per-node and cluster-wide CPU usage
- **Memory Consumption**: Available vs. used memory
- **Storage I/O**: Disk read/write performance
- **Network Bandwidth**: Interface utilization and saturation

**Application Performance**:
- **Response Times**: HTTP request latency tracking
- **Throughput**: Requests per second and data transfer
- **Error Rates**: 4xx/5xx HTTP error percentages
- **Database Performance**: Query execution times and locks

### Capacity Planning
**Growth Tracking**:
- **Storage Growth**: Media library and application data growth
- **User Growth**: Application usage trends
- **Resource Trends**: Historical resource utilization
- **Scaling Triggers**: Automatic scaling thresholds

**Forecasting**:
- **Storage Capacity**: Projected storage exhaustion dates
- **Resource Requirements**: Future hardware needs
- **Performance Bottlenecks**: Anticipated performance issues
- **Cost Projections**: Resource cost trend analysis

## Health Monitoring

### Service Health Checks
**Endpoint Monitoring**:
- **HTTP Checks**: Application availability and response codes
- **API Health**: REST API endpoint functionality
- **Database Connectivity**: Connection pool and query health
- **External Dependencies**: Third-party service availability

**Deep Health Checks**:
- **Application Logic**: Business function verification
- **Data Consistency**: Database integrity checks
- **Integration Points**: Service-to-service communication
- **Background Jobs**: Scheduled task execution

### Synthetic Monitoring
**User Journey Testing**:
- **Login Flows**: Authentication system testing
- **Core Workflows**: Critical application functions
- **Performance Baseline**: Response time benchmarking
- **Cross-service**: End-to-end transaction monitoring

**Geographic Testing**:
- **External Access**: Cloudflare tunnel performance
- **DNS Resolution**: Global DNS propagation
- **CDN Performance**: Content delivery optimization
- **Mobile Access**: Mobile application responsiveness

## Log Management

### Log Collection
**Application Logs**:
- **Structured Logging**: JSON-formatted application logs
- **Kubernetes Logs**: Container stdout/stderr streams
- **System Logs**: Operating system event logs
- **Audit Logs**: Security and compliance logging

**Log Sources**:
- **Applications**: All deployed applications
- **Infrastructure**: Kubernetes components
- **Network**: Ingress and load balancer logs
- **Security**: Authentication and authorization events

### Log Analysis
**Search Capabilities**:
- **Full-text Search**: Log content searching
- **Field Filtering**: Structured field queries
- **Time Range**: Historical log analysis
- **Pattern Matching**: Regular expression searches

**Alerting on Logs**:
- **Error Patterns**: Automatic error detection
- **Security Events**: Suspicious activity identification
- **Performance Issues**: Slow query detection
- **Custom Rules**: User-defined log alerts

## Maintenance and Operations

### Regular Tasks
**Daily Operations**:
- **Dashboard Review**: Check critical metric dashboards
- **Alert Triage**: Review and acknowledge alerts
- **Capacity Check**: Monitor resource utilization
- **Backup Verification**: Confirm monitoring data backups

**Weekly Maintenance**:
- **Dashboard Updates**: Improve and add new dashboards
- **Alert Tuning**: Adjust alert thresholds and rules
- **Performance Review**: Analyze weekly performance trends
- **Documentation**: Update monitoring documentation

**Monthly Planning**:
- **Capacity Planning**: Review growth trends and projections
- **Alert Analysis**: Analyze alert patterns and false positives
- **Dashboard Optimization**: Optimize slow or complex queries
- **Training**: Team training on new monitoring features

### Troubleshooting
**Common Issues**:
- **High Cardinality**: Excessive metric labels causing performance issues
- **Missing Metrics**: Service discovery or scraping problems
- **Alert Fatigue**: Too many or incorrectly configured alerts
- **Dashboard Performance**: Slow loading or complex queries

**Diagnostic Tools**:
- **Prometheus UI**: Target status and query debugging
- **Grafana Explore**: Ad-hoc metric exploration
- **AlertManager**: Alert routing and silencing management
- **Kubernetes Events**: System event correlation

## Integration Points

### GitOps Integration
**Configuration Management**:
- **Dashboard as Code**: Grafana dashboards in Git
- **Alert Rules**: Prometheus rules version controlled
- **Service Discovery**: Automatic target configuration
- **Backup Automation**: Configuration backup via VolSync

**Deployment Pipeline**:
- **Monitoring Deployment**: Application monitoring setup
- **Health Checks**: Deployment success verification
- **Rollback Monitoring**: Deployment issue detection
- **Performance Validation**: Post-deployment performance checks

### External Integrations
**Cloud Services**:
- **Cloudflare**: CDN and DNS performance monitoring
- **External APIs**: Third-party service health
- **Weather Services**: Environmental data correlation
- **Public Endpoints**: Internet accessibility monitoring

**Home Integration**:
- **Home Assistant**: Smart home device monitoring
- **Network Equipment**: Router and switch metrics
- **UPS Systems**: Power management monitoring
- **Environmental**: Temperature and humidity tracking

## Security and Compliance

### Access Control
**Authentication**:
- **Authentik SSO**: Single sign-on for Grafana access
- **Role-based Access**: Different dashboard access levels
- **API Security**: Prometheus API access control
- **Service Accounts**: Automated tool authentication

**Data Protection**:
- **Encryption**: Metrics data encryption at rest
- **Network Security**: TLS for all monitoring traffic
- **Backup Encryption**: Monitoring data backup security
- **Audit Trail**: Access and configuration change logs

### Compliance Monitoring
**Audit Requirements**:
- **Access Logging**: User access to monitoring systems
- **Change Tracking**: Configuration modification history
- **Data Retention**: Compliance with data retention policies
- **Security Events**: Security-relevant metric collection

---

**Last Updated**: 2025-07-19  
**Monitoring Applications**: 4 core services (Prometheus, Grafana, Gatus, N8N)  
**Smart Alert Routing**: Multi-source intelligent notification system  
**Dashboards**: 20+ comprehensive dashboards  
**Metrics Retention**: 14 days  
**Alert Channels**: Discord, Pushover, Silent logging with daily analytics