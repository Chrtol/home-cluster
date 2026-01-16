# Workflow Deprecation Notice

## vps-nginx-deploy.yml → vps-reverse-proxy-deploy.yml

The `vps-nginx-deploy.yml` workflow has been replaced by `vps-reverse-proxy-deploy.yml` to support multiple reverse proxy implementations (nginx-otel and traefik).

### Migration:
- The new workflow triggers on the same paths plus traefik role paths
- It uses the same 1Password secrets with updated names (PROXY_* instead of NGINX_*)
- You can specify the proxy type via environment variable or workflow dispatch

### Key Changes:
1. **Workflow Name**: `vps-reverse-proxy-deploy.yml`
2. **Playbook**: Uses `reverse-proxy.yml` instead of `nginx-only.yml`
3. **Proxy Type**: Configurable via `REVERSE_PROXY_TYPE` (traefik or nginx-otel)
4. **Idempotent**: Ensures only one reverse proxy runs at a time

The old workflow will continue to work for backward compatibility but should be considered deprecated.