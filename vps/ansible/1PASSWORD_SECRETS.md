# 1Password Secrets Configuration

This document lists all the 1Password secrets required for VPS deployment via GitHub Actions.

## Required 1Password Vaults and Items

### 1. VPS Access (Vault: `Lab`, Item: `vps-wireguard`)
- `VPS_IP` - VPS server IP address
- `VPS_SSH_PORT` - SSH port (default: 22)

### 2. VPS SSH Keys (Vault: `Lab`, Item: `pangolin`)
- `PANGOLIN_VPS_SSH_PRIVATE_KEY` - SSH private key for VPS access
- `PANGOLIN_VPS_SSH_USER` - SSH username (default: root)

### 3. Traefik Proxy Configuration (Vault: `Lab`, Item: `vps-proxy`)

#### Required Fields:
- `VPS_PROXY_DOMAIN` - Your domain name
- `VPS_EXTERNAL_INGRESS_IP` - Kubernetes external ingress IP
- `VPS_ENVOY_GATEWAY_IP` - Envoy gateway IP

#### OpenTelemetry Fields:
- `VPS_OTEL_ENDPOINT` - OpenTelemetry collector endpoint
- `VPS_OTEL_SERVICE_NAME` - Service name for traces (default: vps-traefik)
- `VPS_OTEL_SAMPLE_RATE` - Sampling rate 0.0-1.0 (default: 0.75)

#### Authentik Fields (optional):
- `VPS_AUTHENTIK_ENABLED` - Enable Authentik forward auth (true/false, default: false)
- `VPS_AUTHENTIK_DOMAIN` - Authentik instance domain (default: authentik.${VPS_PROXY_DOMAIN})

#### CrowdSec Fields (optional):
- `VPS_CROWDSEC_ENABLED` - Enable CrowdSec protection (true/false, default: true)
- `VPS_CROWDSEC_LAPI_HOST` - CrowdSec LAPI host:port (default: 127.0.0.1:8080)
- `VPS_CROWDSEC_LOG_LEVEL` - CrowdSec plugin log level (default: INFO)

#### Feature Toggles:
- `VPS_ENABLE_ECHO_TEST` - Enable echo test endpoint (true/false, default: true)
- `VPS_ENABLE_METRICS` - Enable metrics endpoints (true/false, default: true)

#### Metrics Authentication (required if VPS_ENABLE_METRICS is true):
- `VPS_METRICS_USER` - Username for metrics basic auth (e.g., `prometheus`)
- `VPS_METRICS_PASSWORD` - Plaintext password for metrics auth (used by Prometheus scraper)
- `VPS_METRICS_PASSWORD_HASH` - bcrypt hash for metrics auth, used by Traefik (generate with `htpasswd -nB prometheus`)

### 4. Trivy Security Scanner (Vault: `Lab`, Item: `trivy-server`)
- `TRIVY_SERVER_TOKEN` - Authentication token for Trivy server (generate with `openssl rand -hex 32`)

The Trivy server URL is derived from your domain: `https://trivy.${SECRET_DOMAIN}`

### 5. CrowdSec Bouncer API Key (Vault: `Lab`, Item: `crowdsec`)
**This item must be created after setting up the CrowdSec bouncer on the VPS**

#### Required Field:
- `CROWDSEC_VPS_TRAEFIK_BOUNCER_API_KEY` - The bouncer API key from `sudo cscli bouncers add vps-traefik-main`

## GitHub Secrets

Only one secret needs to be configured in GitHub:
- `OP_SERVICE_ACCOUNT_TOKEN` - 1Password service account token for accessing the vaults

## Creating 1Password Items via CLI

```bash
# Install 1Password CLI
# https://developer.1password.com/docs/cli/get-started/

# Login
op signin

# Create or update vps-proxy item
op item edit "vps-proxy" --vault="Lab" \
  "VPS_PROXY_DOMAIN[text]={your domain}" \
  "VPS_EXTERNAL_INGRESS_IP[text]={your IP}" \
  "VPS_ENVOY_GATEWAY_IP[text]={your IP}" \
  "VPS_OTEL_ENDPOINT[text]=tempo-otlp.{domain}:443" \
  "VPS_OTEL_SERVICE_NAME[text]=vps-traefik" \
  "VPS_OTEL_SAMPLE_RATE[text]=0.75" \
  "VPS_AUTHENTIK_ENABLED[text]=false" \
  "VPS_AUTHENTIK_DOMAIN[text]=authentik.{domain}" \
  "VPS_ENABLE_ECHO_TEST[text]=true" \
  "VPS_ENABLE_METRICS[text]=true" \
  "VPS_METRICS_USER[text]=prometheus" \
  "VPS_METRICS_PASSWORD[text]={your password}" \
  "VPS_METRICS_PASSWORD_HASH[text]=$(htpasswd -nB prometheus {your password} | cut -d: -f2)"

# Configure CrowdSec settings
op item edit "vps-proxy" --vault="Lab" \
  "VPS_CROWDSEC_ENABLED[text]=true" \
  "VPS_CROWDSEC_LAPI_HOST[text]=127.0.0.1:8080" \
  "VPS_CROWDSEC_LOG_LEVEL[text]=INFO"

# Create CrowdSec item and add bouncer key (after running `sudo cscli bouncers add vps-traefik-main`)
op item create --vault="Lab" --title="crowdsec" --category="API Credential" \
  "CROWDSEC_VPS_TRAEFIK_BOUNCER_API_KEY[text]=YOUR_BOUNCER_API_KEY_HERE"
```

## Security Notes

1. **Never commit secrets** to the repository
2. **Use 1Password references** in all Ansible playbooks
3. **Rotate SSH keys** regularly
4. **Limit API token permissions** to minimum required
5. **Use separate service accounts** for different environments

## Troubleshooting

### Secret not found
```
Error: op://Lab/vps-proxy/DOMAIN not found
```
Solution: Ensure the item exists in 1Password and the service account has access to the Lab vault.

### SSH connection fails
Check:
- VPS_IP is correct
- SSH key has proper permissions (600)
- VPS_SSH_PORT matches server configuration
- Firewall rules allow SSH access
