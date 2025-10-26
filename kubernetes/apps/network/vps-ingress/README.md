# VPS Ingress System

This directory contains the VPS ingress system, which allows exposing home cluster services through a VPS reverse proxy without violating Cloudflare's Terms of Service.

## Architecture

```
Internet → VPS (nginx with SSL) → WireGuard Tunnel → Home Cluster (nginx-ingress) → Service
```

### Components

1. **WireGuard DaemonSet** - Establishes encrypted tunnel between VPS and home cluster
   - VPS endpoint: `10.100.0.1`
   - Home endpoint: `10.100.0.2`
   - Runs as privileged DaemonSet on all nodes

2. **Custom IngressClass** - `vps` IngressClass for routing traffic through VPS
   - Controller: `k8s.io/external` (reuses external nginx-ingress controller)
   - Any ingress with `ingressClassName: vps` routes through VPS

3. **External-DNS-VPS** - Dedicated external-dns instance for VPS DNS records
   - Watches: DNSEndpoint CRDs only
   - TXT Owner ID: `vps`
   - TXT Prefix: `k8s-vps.`
   - Creates DNS A records pointing to VPS public IP

4. **VPS Nginx** - Reverse proxy on VPS server
   - SSL termination with Let's Encrypt
   - Proxies traffic to home cluster via WireGuard tunnel (10.100.0.2:80)

## Usage

To expose a service through the VPS:

### 1. Create an Ingress with VPS IngressClass

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp
  namespace: myapp
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    external-dns.alpha.kubernetes.io/exclude: "true"  # Prevent regular external-dns from managing
spec:
  ingressClassName: vps
  rules:
    - host: myapp.${SECRET_DOMAIN}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp
                port:
                  number: 80
  tls:
    - hosts:
        - myapp.${SECRET_DOMAIN}
```

### 2. Create a DNSEndpoint for DNS Management

```yaml
apiVersion: externaldns.k8s.io/v1alpha1
kind: DNSEndpoint
metadata:
  name: myapp-vps
  namespace: myapp
  annotations:
    external-dns.alpha.kubernetes.io/exclude: "true"  # Exclude from regular external-dns
spec:
  endpoints:
    - dnsName: myapp.${SECRET_DOMAIN}
      recordType: A
      targets:
        - ${VPS_PUBLIC_IP}
      providerSpecific:
        - name: cloudflare-proxied
          value: "false"  # Grey cloud - DNS only, no Cloudflare proxy
```

### 3. Add VPS Nginx Configuration

SSH to VPS and run:

```bash
/usr/local/bin/add-vps-service.sh myapp.${SECRET_DOMAIN}
```

This will:
- Create nginx configuration for the service
- Obtain Let's Encrypt SSL certificate
- Reload nginx

## How It Works

1. **DNS Resolution**: DNSEndpoint creates A record pointing to VPS public IP (grey cloud)
2. **SSL Termination**: VPS nginx handles HTTPS and Let's Encrypt certificates
3. **WireGuard Tunnel**: Encrypted traffic from VPS to home cluster
4. **Home Routing**: nginx-ingress controller routes based on Host header to target service

## Important Notes

- **Regular external-dns exclusion**: Services using VPS ingress must be excluded from regular external-dns to prevent DNS record conflicts
  - Add subdomain to `excludeDomains` in regular external-dns HelmRelease
  - OR use DNSEndpoint with exclude annotation instead of ingress annotations

- **Cloudflare DNS-only mode**: All VPS DNS records use grey cloud (DNS-only, no proxy) to comply with Cloudflare ToS

- **WireGuard secrets**: Stored in 1Password under `vps-wireguard` entry with prefix `VPS_*`

## DNS Record Conflict Prevention

The regular external-dns and external-dns-vps can conflict if both try to manage the same DNS records. To prevent this:

1. **Preferred method**: Add subdomain to `excludeDomains` in regular external-dns:
   ```yaml
   # kubernetes/apps/network/external/external-dns/app/helmrelease.yaml
   excludeDomains: ["myapp.${SECRET_DOMAIN}"]
   ```

2. **Alternative**: Use DNSEndpoint with exclude annotation (regular external-dns respects this)

## VPS Setup

See VPS server for:
- WireGuard configuration: `/etc/wireguard/wg0.conf`
- Nginx configurations: `/etc/nginx/sites-available/`
- Automation scripts: `/usr/local/bin/add-vps-service.sh`, `/usr/local/bin/nginx-vps-reload.sh`

## Monitoring

TODO: Set up monitoring and alerting for VPS health and WireGuard tunnel status
