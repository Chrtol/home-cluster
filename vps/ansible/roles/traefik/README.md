# Traefik Reverse Proxy Role

This Ansible role deploys Traefik as a reverse proxy replacement for nginx-otel, with full OpenTelemetry support including proper CLIENT/SERVER spans for working service graphs.

## Why Traefik over nginx?

1. **Proper OpenTelemetry Support**: Traefik emits both CLIENT and SERVER spans, fixing the service graph visualization issue
2. **Native Authentik Integration**: Built-in forward auth support for Authentik
3. **Gateway API Ready**: Full support for the Kubernetes Gateway API (future-proof)
4. **Auto-Configuration**: Automatic Let's Encrypt certificates via Cloudflare DNS
5. **Active Development**: Unlike nginx-ingress (EOL March 2026), Traefik is actively maintained

## Features

- ✅ OpenTelemetry tracing with proper CLIENT/SERVER spans
- ✅ Automatic HTTPS with Let's Encrypt (Cloudflare DNS challenge)
- ✅ HTTP/2 and HTTP/3 support
- ✅ Authentik forward authentication (optional)
- ✅ Security headers middleware
- ✅ Rate limiting support
- ✅ Prometheus metrics
- ✅ Health check endpoint
- ✅ JSON structured logging

## Configuration

### Required Variables

```yaml
# Domain configuration
nginx_domain: "example.com"  # Your domain
nginx_external_ingress_ip: "10.0.30.60"  # Kubernetes external ingress IP

# Cloudflare credentials (for Let's Encrypt)
cloudflare_email: "your-email@example.com"
cloudflare_api_token: "your-cloudflare-api-token"
```

### Optional Variables

```yaml
# OpenTelemetry
traefik_otel_endpoint: "tempo-otlp.example.com:443"
traefik_service_name: "vps-traefik"
traefik_sample_rate: "0.75"

# Authentik (enable when ready)
traefik_enable_authentik: true
traefik_authentik_skip_verify: false

# Logging
traefik_log_level: "INFO"  # DEBUG, INFO, WARN, ERROR
```

## Migration from nginx-otel

### 1. Stop nginx-otel

```bash
cd /opt/nginx-otel
docker-compose down
```

### 2. Deploy Traefik

Update your playbook to use the traefik role instead of nginx-otel:

```yaml
- hosts: vps
  roles:
    - traefik  # Replace nginx-otel with traefik
```

### 3. Run the playbook

```bash
ansible-playbook -i inventory site.yml --tags traefik
```

### 4. Verify the deployment

```bash
# Check health
curl http://your-vps-ip/health

# Check traces in Grafana
# You should now see proper service graph edges!
```

## Service Graph Fix

The key configuration for proper service graphs is:

```yaml
traceVerbosity: minimal
```

This ensures Traefik emits exactly one SERVER span (incoming) and one CLIENT span (outgoing) per request, creating the proper edges in Tempo's service graph.

## Authentik Integration

When you're ready to enable Authentik forward auth:

1. Set `traefik_enable_authentik: true` in your variables
2. Ensure Authentik is accessible at `https://authentik.{{ traefik_domain }}`
3. Configure a Proxy Provider in Authentik for Traefik
4. Re-run the playbook

## Monitoring

### Traces
- Traces are sent to Tempo via OTLP/gRPC
- Service name: `vps-traefik`
- Both CLIENT and SERVER spans are properly created

### Metrics
- Prometheus metrics available internally
- Can be scraped by your monitoring stack

### Logs
- Access logs: `/opt/traefik/logs/access.log` (JSON format)
- Application logs: `/opt/traefik/logs/traefik.log`

## Troubleshooting

### Service graph not showing connections?
- Verify `traceVerbosity: minimal` in configuration
- Check Tempo is receiving traces: `kubectl logs -n observability deployment/tempo-distributor`
- Wait ~30 seconds for service graph processor to update

### Certificate issues?
- Check Cloudflare API token has DNS edit permissions
- Verify domain is managed by Cloudflare
- Check ACME storage: `ls -la /opt/traefik/acme/acme.json`

### Authentik forward auth not working?
- Verify Authentik is accessible from VPS
- Check the Proxy Provider configuration in Authentik
- Review Traefik logs for auth errors

## Directory Structure

```
/opt/traefik/
├── config/
│   ├── traefik.yml     # Static configuration
│   └── dynamic.yml     # Dynamic configuration (routes, services)
├── acme/
│   └── acme.json       # Let's Encrypt certificates
├── logs/
│   ├── access.log      # Access logs (JSON)
│   └── traefik.log     # Application logs
└── docker-compose.yml  # Container definition
```

## Links

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Traefik OpenTelemetry](https://doc.traefik.io/traefik/observability/tracing/opentelemetry/)
- [Authentik Forward Auth](https://docs.goauthentik.io/providers/proxy/forward_auth/)
- [Gateway API](https://gateway-api.sigs.k8s.io/)