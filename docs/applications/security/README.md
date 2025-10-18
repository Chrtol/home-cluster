# Security Applications

Authentication, authorization, and identity management services for the cluster.

## Identity Provider

### 🔐 Authentik
- **URL**: [sso.example.com](https://sso.example.com)
- **Purpose**: Enterprise-grade identity provider and SSO solution
- **Role**: Primary authentication system for external applications

**Core Features**:
- **Single Sign-On (SSO)**: OIDC, SAML, OAuth2 protocols
- **Multi-Factor Authentication**: TOTP, WebAuthn, SMS support
- **Forward Auth**: nginx-ingress integration for transparent auth
- **User Management**: Self-service password reset and profile management
- **Admin Interface**: Web-based administration console

**Protocol Support**:
- **OpenID Connect (OIDC)**: Modern authentication standard
- **SAML 2.0**: Enterprise SSO integration
- **OAuth2**: API authorization flows
- **LDAP**: Legacy system integration via LLDAP backend

**Authentication Flows**:
- **Forward Auth**: Transparent authentication for web applications
- **Application Integration**: Direct OIDC/SAML integration
- **API Access**: OAuth2 for programmatic access
- **Mobile Apps**: Native mobile authentication support

### User Lifecycle Management
**User Registration**:
- **Self-Registration**: Configurable user signup flows
- **Invitation-Based**: Admin-controlled user creation
- **Email Verification**: Automated email verification process
- **Profile Completion**: Required field enforcement

**Account Management**:
- **Password Policies**: Configurable complexity requirements
- **Account Recovery**: Secure password reset flows
- **Session Management**: Configurable session timeouts
- **Audit Logging**: Complete authentication audit trail

## Directory Services

### 📂 LLDAP
- **Purpose**: Lightweight LDAP directory server
- **Role**: User directory backend for Authentik
- **Protocol**: LDAP v3 compatible

**Key Features**:
- **Web Interface**: Modern web-based administration
- **User Management**: Simple user and group management
- **LDAP Compatibility**: Standard LDAP protocol support
- **Minimal Footprint**: Lightweight resource usage
- **SQLite Backend**: Simple, reliable data storage

**Directory Structure**:
```
dc=example,dc=com
├── ou=people
│   ├── uid=admin
│   ├── uid=user1
│   └── uid=user2
└── ou=groups
    ├── cn=admins
    ├── cn=users
    └── cn=media
```

**Group Management**:
- **Admin Groups**: Administrative access control
- **User Groups**: Application access permissions
- **Service Accounts**: System service authentication
- **Dynamic Groups**: Automated group membership

## Application Integration

### Forward Authentication
**Nginx Ingress Integration**:
- **Transparent Auth**: Users authenticate once, access multiple apps
- **Header Injection**: User information passed to applications
- **Authorization**: Group-based access control
- **Session Sharing**: Single session across applications

**Protected Applications**:
- Grafana (monitoring dashboards)
- Jellyseerr (media requests)
- Home Assistant (when external)
- Immich (photo management)
- Sonarr/Radarr (when needed)

### OIDC Integration
**Native OIDC Applications**:
- **Grafana**: Direct OIDC integration with role mapping
- **Future Apps**: Ready for OIDC-capable applications
- **Custom Claims**: Application-specific user attributes
- **Role Mapping**: LDAP groups to application roles

### API Authentication
**Service-to-Service**:
- **OAuth2 Client Credentials**: Machine-to-machine auth
- **API Keys**: Legacy system integration
- **JWT Tokens**: Stateless API authentication
- **Rate Limiting**: API abuse protection

## Security Configuration

### Multi-Factor Authentication
**Supported Methods**:
- **TOTP**: Time-based OTP (Google Authenticator, Authy)
- **WebAuthn**: Hardware security keys (YubiKey, etc.)
- **Backup Codes**: Recovery code generation
- **SMS**: Text message verification (configurable)

**MFA Policies**:
- **Conditional MFA**: Risk-based authentication
- **Admin Required**: MFA mandatory for administrators
- **Device Trust**: Trusted device management
- **Grace Periods**: Configurable MFA frequency

### Password Security
**Password Policies**:
- **Complexity**: Minimum length and character requirements
- **History**: Prevent password reuse
- **Expiration**: Configurable password aging
- **Breach Detection**: HaveIBeenPwned integration

**Account Protection**:
- **Lockout Protection**: Brute force attack prevention
- **Rate Limiting**: Login attempt throttling
- **Suspicious Activity**: Automated threat detection
- **Audit Logging**: Complete security event logging

### Network Security
**Access Control**:
- **IP Whitelisting**: Restrict admin access by IP
- **Geographic Restrictions**: Location-based access control
- **VPN Integration**: Require VPN for sensitive operations
- **Device Registration**: Known device management

**TLS Configuration**:
- **Strong Ciphers**: Modern TLS cipher suites
- **HSTS**: HTTP Strict Transport Security
- **Certificate Pinning**: Enhanced certificate security
- **Perfect Forward Secrecy**: Session key protection

## High Availability & Backup

### Data Protection
**Database Backup**:
- **PostgreSQL**: Automated backups via CloudNative-PG
- **VolSync**: Configuration and user data backups
- **LDAP Export**: Regular LDIF exports
- **Encryption**: Backup encryption at rest

**Disaster Recovery**:
- **Configuration**: Infrastructure as Code via Flux
- **User Data**: Database restoration procedures
- **Secrets**: SOPS-encrypted secret management
- **Testing**: Regular disaster recovery testing

### Performance & Scaling
**Resource Allocation**:
- **Authentik**: 500m CPU, 1Gi RAM
- **LLDAP**: 100m CPU, 256Mi RAM
- **Database**: Shared PostgreSQL cluster
- **Storage**: Ceph RBD persistent volumes

**Caching**:
- **Redis**: Session and cache storage
- **LDAP Cache**: Reduced directory lookup latency
- **Static Assets**: CDN for UI resources
- **Database Connections**: Connection pooling

## Monitoring & Alerting

### Security Monitoring
**Authentication Events**:
- **Failed Logins**: Brute force attack detection
- **Successful Logins**: User activity tracking
- **MFA Events**: Multi-factor authentication monitoring
- **Admin Actions**: Administrative activity logging

**Prometheus Metrics**:
- **Login Success/Failure Rates**: Authentication health
- **Session Count**: Active user sessions
- **Response Times**: Authentication performance
- **Error Rates**: System health indicators

**Grafana Dashboards**:
- **Authentication Overview**: Login statistics and trends
- **Security Events**: Failed attempts and anomalies
- **User Activity**: Session and usage patterns
- **System Health**: Service availability and performance

### Alerting Rules
**Security Alerts**:
- **Multiple Failed Logins**: Potential brute force attacks
- **Admin Login**: Administrative access notifications
- **Unusual Activity**: Anomalous login patterns
- **Service Downtime**: Authentication service failures

**Operational Alerts**:
- **Database Issues**: Backend connectivity problems
- **Certificate Expiry**: TLS certificate renewal warnings
- **Resource Usage**: High CPU/memory consumption
- **Backup Failures**: Data protection issues

## User Management Workflows

### User Onboarding
1. **Account Creation**: Admin creates user in LLDAP
2. **Group Assignment**: Add user to appropriate groups
3. **Password Setup**: User receives secure password reset link
4. **MFA Enrollment**: User configures multi-factor authentication
5. **Application Access**: Automatic access via group membership

### Access Review
**Periodic Reviews**:
- **User Audit**: Quarterly user access review
- **Group Membership**: Regular group assignment validation
- **Inactive Users**: Automated inactive account detection
- **Privilege Escalation**: Administrative access reviews

**Compliance**:
- **Audit Logs**: Complete authentication and authorization logs
- **Access Reports**: User and application access reports
- **Change Tracking**: User and permission change history
- **Retention**: Configurable log retention periods

## Troubleshooting

### Common Issues
**Authentication Problems**:
- **Login Failures**: Check user status and group membership
- **MFA Issues**: Verify TOTP time synchronization
- **Application Access**: Validate group-based permissions
- **Session Problems**: Check Redis connectivity

**LDAP Connectivity**:
- **Connection Failures**: Verify LLDAP service health
- **Slow Queries**: Check LDAP query performance
- **Data Sync**: Ensure Authentik-LLDAP synchronization
- **Group Resolution**: Validate group membership queries

### Diagnostic Tools
**Authentik Admin Interface**:
- **User Management**: View and edit user accounts
- **Event Logs**: Review authentication events
- **Provider Configuration**: Validate application integrations
- **System Status**: Check service health

**LLDAP Web Interface**:
- **Directory Browser**: View LDAP directory structure
- **User Editor**: Manage user accounts and attributes
- **Group Management**: Edit group memberships
- **Schema Viewer**: Review LDAP schema

### Log Analysis
**Log Locations**:
- **Authentik**: Kubernetes stdout logs
- **LLDAP**: Kubernetes stdout logs
- **Database**: PostgreSQL logs
- **Ingress**: nginx access and error logs

**Log Patterns**:
- **Successful Auth**: `Login successful for user <username>`
- **Failed Auth**: `Authentication failed for user <username>`
- **MFA Events**: `MFA challenge completed for user <username>`
- **Admin Actions**: `Administrative action by user <admin>`

## Security Best Practices

### Operational Security
**Regular Tasks**:
- **User Review**: Monthly user access review
- **Certificate Management**: Quarterly certificate rotation
- **Security Updates**: Regular software updates
- **Backup Verification**: Weekly backup restoration testing

**Incident Response**:
- **Breach Detection**: Automated anomaly detection
- **Account Lockdown**: Rapid user account suspension
- **Forensics**: Complete audit trail preservation
- **Communication**: Incident notification procedures

### Configuration Hardening
**Security Settings**:
- **Strong Passwords**: Enforce complex password policies
- **Session Security**: Short session timeouts for sensitive apps
- **Network Isolation**: Restrict admin interface access
- **Encryption**: End-to-end encryption for all communications

---

**Last Updated**: 2025-07-16  
**Security Applications**: 2 core services  
**Protected Applications**: 10+ integrated services  
**User Capacity**: Unlimited with current architecture