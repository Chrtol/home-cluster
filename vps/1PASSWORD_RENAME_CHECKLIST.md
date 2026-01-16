# 1Password Item Rename Checklist

## Quick Steps to Update Your 1Password Configuration

### 1. Rename the Item
```bash
# Using 1Password CLI
op item edit "vps-nginx" --vault="Lab" --title="vps-proxy"

# Or via 1Password GUI:
# 1. Open 1Password
# 2. Go to Lab vault
# 3. Find "vps-nginx" item
# 4. Edit → Rename to "vps-proxy"
```

### 2. Update Field Names

The existing fields need to be renamed (replace VPS_NGINX_ with VPS_):

| Old Field Name | New Field Name | Notes |
|----------------|----------------|-------|
| `VPS_NGINX_DOMAIN` | `VPS_PROXY_DOMAIN` | Keep the value |
| `VPS_NGINX_EXTERNAL_INGRESS_IP` | `VPS_EXTERNAL_INGRESS_IP` | Keep the value |
| `VPS_NGINX_ENVOY_GATEWAY_IP` | `VPS_ENVOY_GATEWAY_IP` | Keep the value |
| `VPS_NGINX_SSL_CERT_PATH` | `VPS_SSL_CERT_PATH` | Keep the value |
| `VPS_NGINX_SSL_KEY_PATH` | `VPS_SSL_KEY_PATH` | Keep the value |

### 3. Add New Fields

Add these new fields to support Traefik (all with VPS_ prefix):

| Field Name | Value | Purpose |
|------------|-------|---------|
| `VPS_PROXY_TYPE` | `traefik` or `nginx-otel` | Choose which proxy to deploy |
| `VPS_OTEL_ENDPOINT` | `tempo-otlp.{your-domain}:443` | OpenTelemetry collector endpoint |
| `VPS_OTEL_SERVICE_NAME` | `vps-traefik` | Service name in traces |
| `VPS_OTEL_SAMPLE_RATE` | `0.75` | Sampling rate (0.0-1.0) |
| `VPS_AUTHENTIK_ENABLED` | `false` | Enable when ready |
| `VPS_AUTHENTIK_DOMAIN` | `authentik.{your-domain}` | Authentik URL |
| `VPS_ENABLE_ECHO_TEST` | `true` | Enable test endpoint |
| `VPS_ENABLE_METRICS` | `true` | Enable metrics |

### 4. Using 1Password CLI (Complete Command)

```bash
# All in one command
op item edit "vps-proxy" --vault="Lab" \
  "VPS_PROXY_TYPE[text]=traefik" \
  "VPS_PROXY_DOMAIN[text]={keep existing value}" \
  "VPS_EXTERNAL_INGRESS_IP[text]={keep existing value}" \
  "VPS_ENVOY_GATEWAY_IP[text]={keep existing value}" \
  "VPS_SSL_CERT_PATH[text]={keep existing value}" \
  "VPS_SSL_KEY_PATH[text]={keep existing value}" \
  "VPS_OTEL_ENDPOINT[text]=tempo-otlp.{your-domain}:443" \
  "VPS_OTEL_SERVICE_NAME[text]=vps-traefik" \
  "VPS_OTEL_SAMPLE_RATE[text]=0.75" \
  "VPS_AUTHENTIK_ENABLED[text]=false" \
  "VPS_AUTHENTIK_DOMAIN[text]=authentik.{your-domain}" \
  "VPS_ENABLE_ECHO_TEST[text]=true" \
  "VPS_ENABLE_METRICS[text]=true"
```

### 5. Verify Changes

```bash
# Check the item has all required fields
op item get "vps-proxy" --vault="Lab" --format json | jq '.fields[].label'
```

## Why These Changes?

- **Item Rename**: `vps-nginx` → `vps-proxy` (more generic, supports both nginx and traefik)
- **Field Simplification**: Removed `VPS_NGINX_` prefix from field names
- **New Fields**: Added support for Traefik-specific features and OpenTelemetry configuration
- **Backward Compatible**: Old nginx workflow will work with the renamed item

## After Updating 1Password

1. The GitHub workflows will automatically use the new item name and fields
2. Both `vps-nginx-deploy.yml` and `vps-reverse-proxy-deploy.yml` will work
3. You can switch between nginx and traefik by changing `VPS_PROXY_TYPE`

## Testing

Run a dry-run deployment to verify everything works:
```bash
# Via GitHub Actions UI
Actions → Deploy VPS Reverse Proxy Configuration → Run workflow
- Proxy type: traefik
- Dry run: true
```