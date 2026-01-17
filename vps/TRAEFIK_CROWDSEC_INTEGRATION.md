# Traefik CrowdSec Integration Guide

## Overview

This document describes the integration between the main VPS Traefik reverse proxy and the system CrowdSec service. The integration provides real-time security decisions for all incoming HTTP/HTTPS traffic.

## Architecture

```
Internet Traffic
      ↓
Traefik (ports 80/443)
      ↓
CrowdSec Plugin Middleware
      ↓
Queries System CrowdSec LAPI (127.0.0.1:8080)
      ↓
Allow/Block Decision
      ↓
Route to Kubernetes Ingress or Block
```

## Components

### 1. System CrowdSec Service
- **Type**: Host-based systemd service
- **LAPI Port**: 127.0.0.1:8080
- **Configuration**: `/etc/crowdsec/`
- **Status Check**: `sudo systemctl status crowdsec`

### 2. Traefik CrowdSec Plugin
- **Plugin**: github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin
- **Version**: v1.3.5
- **Mode**: Stream mode (real-time decisions)
- **Update Interval**: 10 seconds

### 3. CrowdSec Bouncer
- **Name**: `vps-traefik-main`
- **Purpose**: Authenticates Traefik to query CrowdSec decisions
- **Key Storage**: 1Password vault `Lab`, item `crowdsec`, field `CROWDSEC_VPS_TRAEFIK_BOUNCER_API_KEY`

## Configuration

### 1Password Secrets

The following secrets must be configured in 1Password:

#### Vault: `Lab`, Item: `vps-proxy`
- `VPS_CROWDSEC_ENABLED`: "true" or "false" (default: "true")
- `VPS_CROWDSEC_LAPI_HOST`: CrowdSec LAPI address (default: "127.0.0.1:8080")
- `VPS_CROWDSEC_LOG_LEVEL`: Plugin log level (default: "INFO")

#### Vault: `Lab`, Item: `crowdsec`
- `CROWDSEC_VPS_TRAEFIK_BOUNCER_API_KEY`: The bouncer API key (required)

### Traefik Configuration

#### Static Configuration (`traefik.yml`)
```yaml
experimental:
  plugins:
    crowdsec-bouncer-traefik-plugin:
      moduleName: github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin
      version: v1.3.5

plugin:
  crowdsec-bouncer-traefik-plugin:
    enabled: true
    crowdsecLapiKey: ${CROWDSEC_BOUNCER_API_KEY}
    crowdsecLapiHost: 127.0.0.1:8080
    crowdsecMode: stream
```

#### Dynamic Configuration (`dynamic.yml`)
```yaml
http:
  middlewares:
    crowdsec-bouncer:
      plugin:
        crowdsec-bouncer-traefik-plugin:
          enabled: true
          # ... plugin configuration ...

  routers:
    kubernetes-ingress:
      middlewares:
        - crowdsec-bouncer  # Applied first for security
        - security-headers
        # ... other middlewares
```

## Deployment

### Initial Setup

1. **Create the CrowdSec bouncer** (one-time setup):
   ```bash
   # SSH to VPS
   ssh user@vps

   # Create bouncer (if not exists)
   sudo cscli bouncers add vps-traefik-main

   # Note the API key that's displayed
   ```

2. **Store the API key in 1Password**:
   ```bash
   # On local machine with 1Password CLI
   op item edit "crowdsec" --vault="Lab" \
     "CROWDSEC_VPS_TRAEFIK_BOUNCER_API_KEY[text]=YOUR_API_KEY_HERE"
   ```

3. **Configure additional settings in 1Password** (optional):
   ```bash
   # Enable/disable CrowdSec
   op item edit "vps-proxy" --vault="Lab" \
     "VPS_CROWDSEC_ENABLED[text]=true"

   # Set custom LAPI host if needed
   op item edit "vps-proxy" --vault="Lab" \
     "VPS_CROWDSEC_LAPI_HOST[text]=127.0.0.1:8080"

   # Set log level (DEBUG, INFO, WARN, ERROR)
   op item edit "vps-proxy" --vault="Lab" \
     "VPS_CROWDSEC_LOG_LEVEL[text]=INFO"
   ```

4. **Deploy via GitHub Actions**:
   - Push changes to main branch
   - GitHub Actions workflow will automatically deploy
   - Or trigger manually via workflow dispatch

### Manual Deployment

```bash
# From local machine
cd vps/ansible

# Deploy Traefik with CrowdSec
ansible-playbook reverse-proxy.yml \
  -i inventory.yml \
  -e "REVERSE_PROXY_TYPE=traefik"
```

## Operations

### Verify Integration

1. **Check bouncer registration**:
   ```bash
   sudo cscli bouncers list
   ```

2. **Check CrowdSec decisions**:
   ```bash
   sudo cscli decisions list
   ```

3. **Check Traefik logs**:
   ```bash
   docker logs traefik | grep -i crowdsec
   ```

4. **Test with a banned IP**:
   ```bash
   # Add a test ban (1 minute)
   sudo cscli decisions add -i 1.2.3.4 -t ban -d 1m

   # Test from that IP (should be blocked)
   curl -H "X-Forwarded-For: 1.2.3.4" https://your-domain.com

   # Remove the ban
   sudo cscli decisions delete -i 1.2.3.4
   ```

### Monitoring

1. **CrowdSec metrics**:
   ```bash
   sudo cscli metrics
   ```

2. **Traefik metrics** (if enabled):
   ```bash
   curl http://localhost:8082/metrics | grep crowdsec
   ```

3. **View blocked requests in Traefik logs**:
   ```bash
   docker logs traefik -f | grep -E "crowdsec.*blocked"
   ```

### Troubleshooting

#### Bouncer API Key Issues

If the bouncer key is lost or compromised:

1. **Delete the old bouncer**:
   ```bash
   sudo cscli bouncers delete vps-traefik-main
   ```

2. **Create a new bouncer**:
   ```bash
   sudo cscli bouncers add vps-traefik-main
   ```

3. **Update 1Password with the new key**:
   ```bash
   op item edit "crowdsec" --vault="Lab" \
     "CROWDSEC_VPS_TRAEFIK_BOUNCER_API_KEY[text]=NEW_API_KEY"
   ```

4. **Redeploy Traefik** (via GitHub Actions or manually)

#### CrowdSec LAPI Connection Issues

1. **Verify CrowdSec is running**:
   ```bash
   sudo systemctl status crowdsec
   ```

2. **Check LAPI is listening**:
   ```bash
   sudo ss -tlnp | grep 8080
   ```

3. **Test LAPI connectivity**:
   ```bash
   curl http://127.0.0.1:8080/v1/info
   ```

4. **From Traefik container**:
   ```bash
   docker exec traefik curl http://host.docker.internal:8080/v1/info
   ```

#### Disable CrowdSec Temporarily

To disable CrowdSec without removing the configuration:

1. **Update 1Password**:
   ```bash
   op item edit "vps-proxy" --vault="Lab" \
     "VPS_CROWDSEC_ENABLED[text]=false"
   ```

2. **Redeploy via GitHub Actions or manually**

## Security Considerations

### Middleware Order

The CrowdSec middleware is applied **first** in the middleware chain to ensure malicious traffic is blocked before any other processing:

```yaml
middlewares:
  - crowdsec-bouncer    # First: Block bad actors
  - security-headers    # Second: Apply security headers
  - authentik-forward   # Third: Authentication (if enabled)
  - rate-limit         # Fourth: Rate limiting
```

### Trusted IPs

The plugin is configured to trust forwarded headers from private networks:
- 10.0.0.0/8
- 172.16.0.0/12
- 192.168.0.0/16

This ensures proper client IP detection when behind other proxies.

### Exclusions

The health check endpoint (`/ping`) does **not** have CrowdSec middleware applied to ensure monitoring systems can always reach it.

## Integration with Other Services

### Rate Limiting

CrowdSec and rate limiting serve different purposes:
- **CrowdSec**: Blocks known bad actors based on crowd-sourced intelligence
- **Rate Limiting**: Prevents abuse from any source

Both can and should be used together for defense in depth.

### Authentik

If Authentik is enabled, the middleware order ensures:
1. Bad actors are blocked by CrowdSec
2. Legitimate users are then authenticated by Authentik
3. This reduces load on the authentication system

## Maintenance

### Regular Tasks

1. **Update CrowdSec collections** (monthly):
   ```bash
   sudo cscli hub update
   sudo cscli collections upgrade crowdsecurity/linux
   sudo cscli collections upgrade crowdsecurity/traefik
   ```

2. **Review decisions** (weekly):
   ```bash
   sudo cscli decisions list
   sudo cscli alerts list
   ```

3. **Check bouncer status** (monthly):
   ```bash
   sudo cscli bouncers list
   ```

### Plugin Updates

To update the CrowdSec plugin version:

1. Check for new releases: https://github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin/releases
2. Update version in `traefik.yml.j2`:
   ```yaml
   version: vX.X.X  # Update to new version
   ```
3. Deploy via GitHub Actions

## Rollback Procedure

If issues arise with CrowdSec integration:

1. **Quick disable** (keeps configuration):
   ```bash
   # Update 1Password
   op item edit "vps-proxy" --vault="Lab" \
     "VPS_CROWDSEC_ENABLED[text]=false"

   # Trigger deployment
   ```

2. **Complete removal**:
   - Remove CrowdSec configuration from templates
   - Deploy via GitHub Actions
   - Delete bouncer: `sudo cscli bouncers delete vps-traefik-main`

## Related Documentation

- [CrowdSec Documentation](https://docs.crowdsec.net/)
- [Traefik Plugin Documentation](https://github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin)
- [1Password Secrets Configuration](./1PASSWORD_SECRETS.md)
- [Reverse Proxy Deployment](./ansible/roles/traefik/README.md)