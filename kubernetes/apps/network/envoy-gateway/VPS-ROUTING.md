# VPS Nginx Routing Strategies

## Current Setup
- **10.0.30.60** - nginx-ingress (current production)
- **10.0.30.61** - Cilium Gateway (for non-auth services)
- **10.0.30.62** - Envoy Gateway (for auth services)

## Option 1: Service-by-Service Routing
Route specific services to specific gateways based on hostname:

```nginx
# /etc/nginx/sites-available/wildcard-cftollefsen.com
server {
    listen 443 ssl http2;
    server_name *.cftollefsen.com cftollefsen.com;

    # ... existing SSL and proxy settings ...

    # Service-specific routing
    location / {
        # Services with auth → Envoy Gateway
        if ($host ~ ^(glance|radarr|sonarr|prowlarr|readarr|sabnzbd)\.cftollefsen\.com$) {
            proxy_pass https://10.0.30.62:443;
            proxy_ssl_verify off;
            break;
        }

        # Services without auth → Cilium Gateway
        if ($host = plex.cftollefsen.com) {
            proxy_pass https://10.0.30.61:443;
            proxy_ssl_verify off;
            break;
        }

        # Default to nginx-ingress (everything else)
        proxy_pass https://10.0.30.60:443;
        proxy_ssl_verify off;
    }
}
```

## Option 2: Test Prefix Routing
Use a prefix for testing before migration:

```nginx
location / {
    # Test services on Envoy Gateway
    if ($host ~ ^test-(.+)\.cftollefsen\.com$) {
        proxy_pass https://10.0.30.62:443;
        proxy_ssl_verify off;
        break;
    }

    # Production stays on nginx-ingress
    proxy_pass https://10.0.30.60:443;
    proxy_ssl_verify off;
}
```

Then in your HTTPRoute, use `test-glance.cftollefsen.com` for testing.

## Option 3: Gradual Migration with Map
More maintainable approach using nginx map:

```nginx
# Define routing map at http context level
map $host $backend {
    # Auth services → Envoy Gateway
    glance.cftollefsen.com        https://10.0.30.62:443;
    radarr.cftollefsen.com        https://10.0.30.62:443;
    sonarr.cftollefsen.com        https://10.0.30.62:443;

    # Non-auth services → Cilium Gateway
    plex.cftollefsen.com          https://10.0.30.61:443;

    # Default → nginx-ingress
    default                        https://10.0.30.60:443;
}

server {
    listen 443 ssl http2;
    server_name *.cftollefsen.com cftollefsen.com;

    # ... existing SSL and proxy settings ...

    location / {
        proxy_pass $backend;
        proxy_ssl_verify off;
    }
}
```

## Option 4: Header-Based Testing
Test new gateways using a custom header:

```nginx
location / {
    # Test with custom header
    if ($http_x_test_gateway = "envoy") {
        proxy_pass https://10.0.30.62:443;
        proxy_ssl_verify off;
        break;
    }

    if ($http_x_test_gateway = "cilium") {
        proxy_pass https://10.0.30.61:443;
        proxy_ssl_verify off;
        break;
    }

    # Production traffic
    proxy_pass https://10.0.30.60:443;
    proxy_ssl_verify off;
}
```

Then test with: `curl -H "X-Test-Gateway: envoy" https://glance.cftollefsen.com`

## Recommended Approach

**Start with Option 3 (Map-based routing)** because:
1. Clean and maintainable
2. Easy to update by editing the map
3. No complex if statements
4. Can gradually migrate services one by one
5. Easy rollback - just change the map entry

## Migration Process

1. Deploy Envoy Gateway in your cluster
2. Create HTTPRoute for one service (e.g., Glance)
3. Test via direct IP: `curl -k https://10.0.30.62 -H "Host: glance.cftollefsen.com"`
4. If working, update VPS nginx map to route that service
5. Monitor for issues
6. If stable, migrate next service
7. Repeat until all auth services are migrated

## Rollback

If issues occur with a service:
1. Update VPS nginx map to point service back to `https://10.0.30.60:443`
2. Reload nginx: `nginx -s reload`
3. Service instantly rolls back to nginx-ingress