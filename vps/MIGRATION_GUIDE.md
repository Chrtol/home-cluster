# VPS Reverse Proxy Migration Guide

This guide covers migrating from nginx-otel to Traefik for fixing OpenTelemetry service graph issues.

## Why Migrate to Traefik?

1. **Fixes Service Graph**: Traefik emits both CLIENT and SERVER spans, fixing Tempo service graphs
2. **Future-proof**: nginx-ingress goes EOL March 2026, Traefik is actively maintained
3. **Better Integration**: Native Authentik support and Gateway API compliance
4. **Uses existing certificates**: No need for Let's Encrypt, uses your configured SSL certs

## Pre-Migration Checklist

- [ ] Backup current nginx configuration (automatic via playbook)
- [ ] Configure 1Password secrets (see [1PASSWORD_SECRETS.md](ansible/1PASSWORD_SECRETS.md))
- [ ] Ensure GitHub Actions has `OP_SERVICE_ACCOUNT_TOKEN` secret

## Migration Steps

### Step 1: Configure 1Password Secrets

Rename your existing `vps-nginx` item to `vps-proxy` and update fields:

```bash
# Rename the item
op item edit "vps-nginx" --vault="Lab" --title="vps-proxy"

# Update/add required fields with VPS_ prefix
op item edit "vps-proxy" --vault="Lab" \
  "VPS_PROXY_TYPE[text]=traefik" \
  "VPS_PROXY_DOMAIN[text]={your existing domain}" \
  "VPS_EXTERNAL_INGRESS_IP[text]={your existing IP}" \
  "VPS_OTEL_ENDPOINT[text]=tempo-otlp.{domain}:443" \
  "VPS_OTEL_SERVICE_NAME[text]=vps-traefik" \
  "VPS_OTEL_SAMPLE_RATE[text]=0.75"
```

### Step 2: Test with Dry Run

Run the workflow in check mode first:

```bash
# Via GitHub Actions UI:
1. Go to Actions → "Deploy VPS Reverse Proxy Configuration"
2. Click "Run workflow"
3. Select:
   - Proxy type: traefik
   - Dry run: true
   - Debug: true (optional)

# Or via GitHub CLI:
gh workflow run vps-reverse-proxy-deploy.yml \
  -f proxy_type=traefik \
  -f dry_run=true
```

### Step 3: Deploy Traefik

Once dry run passes, deploy for real:

```bash
# Via GitHub Actions UI:
1. Go to Actions → "Deploy VPS Reverse Proxy Configuration"
2. Click "Run workflow"
3. Select:
   - Proxy type: traefik
   - Dry run: false

# The deployment will:
# 1. Stop and remove nginx-otel container
# 2. Deploy Traefik container
# 3. Use your existing SSL certificates from 1Password config
# 4. Set up OpenTelemetry with proper CLIENT/SERVER spans
```

### Step 4: Verify Deployment

1. **Check container status:**
   ```bash
   ssh vps "docker ps | grep traefik"
   ```

2. **Test health endpoint:**
   ```bash
   curl http://<vps-ip>/health
   ```

3. **Check service graph in Grafana:**
   - Navigate to Grafana → Explore → Tempo
   - Select "Service Graph" view
   - You should see proper connections:
     ```
     user → vps-traefik → external-ingress → application
     ```

4. **View Traefik dashboard (optional):**
   ```
   https://traefik.<your-domain>
   ```

### Step 5: Monitor Traces

After deployment, traces should show:
- Service name: `vps-traefik`
- Both CLIENT spans (outgoing to Kubernetes)
- SERVER spans (incoming requests)
- Proper parent-child relationships

## Rollback Procedure

If you need to rollback to nginx-otel:

```bash
# Update 1Password
op item edit "vps-proxy" --vault="Lab" \
  "VPS_PROXY_TYPE[text]=nginx-otel"

# Via GitHub Actions:
1. Go to Actions → "Deploy VPS Reverse Proxy Configuration"
2. Click "Run workflow"
3. Select:
   - Proxy type: nginx-otel
   - Dry run: false

# This will:
# 1. Stop and remove Traefik
# 2. Redeploy nginx-otel
```

## Configuration Comparison

| Feature | nginx-otel | Traefik |
|---------|-----------|---------|
| **Config Location** | `/opt/nginx-otel/` | `/opt/traefik/` |
| **Logs** | `docker logs nginx-otel` | `docker logs traefik` |
| **OpenTelemetry** | SERVER spans only | CLIENT + SERVER spans |
| **Service Name** | `vps-nginx` | `vps-traefik` |
| **Certificates** | Uses existing certs | Uses existing certs |
| **Auth Support** | Basic | Authentik forward auth |

## Troubleshooting

### Port Already in Use
```
Error: bind: address already in use
```
**Solution:** The playbook should stop nginx automatically. If not:
```bash
ssh vps "docker stop nginx-otel && docker rm nginx-otel"
ssh vps "systemctl stop nginx"
```

### Service Graph Still Broken
**Check:**
1. Traefik verbosity is set to `minimal` (not `detailed`)
2. Wait ~30 seconds for service graph processor
3. Verify traces are arriving:
   ```bash
   kubectl logs -n observability deployment/tempo-distributor | grep vps-traefik
   ```

### Health Check Failing
```bash
# Check if Traefik is running
ssh vps "docker ps -a | grep traefik"

# Check logs
ssh vps "docker logs traefik --tail 50"

# Check configuration
ssh vps "cat /opt/traefik/config/traefik.yml"
```

## Post-Migration Tasks

1. **Enable Authentik (optional):**
   - Update 1Password: `AUTHENTIK_ENABLED=true`
   - Configure Authentik Proxy Provider
   - Re-run workflow

2. **Update monitoring:**
   - Update dashboards to use `vps-traefik` service name
   - Create alerts for Traefik metrics

3. **Update documentation:**
   - Update runbooks with new service name
   - Document any custom configurations

## Architectural Benefits

After migration, your architecture will be:

```
Internet → VPS (Traefik) → WireGuard → Kubernetes
                ↓                          ↓
         [CLIENT spans]            [Envoy Gateway]
                ↓                          ↓
         [SERVER spans]              [Applications]
                ↓
         [Tempo Service Graph: WORKING!]
```

## Timeline

- **Now**: Migrate VPS to Traefik (fixes service graph)
- **Before March 2026**: Migrate from ingress-nginx to Envoy Gateway
- **Future**: Unified Gateway API across entire stack

## Support

If you encounter issues:
1. Check logs: `docker logs traefik`
2. Review configuration: `/opt/traefik/config/`
3. Verify 1Password secrets are correct
4. Check GitHub Actions workflow logs