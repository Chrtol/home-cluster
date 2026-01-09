# Nginx Role for VPS GitOps

This role manages nginx configuration on the VPS using GitOps principles. All configuration changes are made in code and applied via Ansible, ensuring consistency and reproducibility.

## Purpose

Provides reverse proxy functionality for the home cluster services, routing traffic from the VPS through the WireGuard tunnel to the external ingress controller.

## Key Fixes Applied

1. **WebSocket Support**: Fixed broken `$http_connection` variable by implementing proper connection upgrade mapping
2. **Streaming Optimization**: Added `proxy_request_buffering off` for improved streaming performance (critical for Plex)
3. **Proper Headers**: Corrected proxy headers for WebSocket and streaming support
4. **SSL Configuration**: Enhanced SSL proxy settings for secure backend connections

## Configuration Variables

All sensitive configuration is stored in 1Password and injected via environment variables:

- `NGINX_DOMAIN`: Your domain name
- `NGINX_EXTERNAL_INGRESS_IP`: External ingress controller IP (via WireGuard)
- `NGINX_ENVOY_GATEWAY_IP`: Envoy gateway IP (optional)
- `NGINX_SSL_CERT_PATH`: Path to SSL certificate (auto-generated if not provided)
- `NGINX_SSL_KEY_PATH`: Path to SSL private key (auto-generated if not provided)

## GitOps Workflow

1. Make changes to the nginx configuration template in this role
2. Commit and push to main branch
3. GitHub Actions automatically deploys the configuration
4. Nginx configuration is updated idempotently on the VPS

## Manual Deployment

```bash
cd vps/ansible
ansible-playbook nginx-only.yml -i inventory.yml
```

## Directory Structure

```
nginx/
├── README.md           # This file
├── defaults/
│   └── main.yml       # Default variables
├── handlers/
│   └── main.yml       # Service handlers (reload/restart)
├── tasks/
│   └── main.yml       # Main tasks for nginx configuration
└── templates/
    └── sites-available/
        └── default.j2  # Nginx site configuration template
```

## Testing

The playbook includes automatic testing:
- Nginx configuration syntax validation
- Service status verification
- Connectivity test to external ingress

## Rollback

Configuration backups are automatically created before each deployment at:
`/tmp/nginx-backup-{timestamp}.tar.gz`