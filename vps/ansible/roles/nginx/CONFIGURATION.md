# Nginx Configuration Documentation

This document explains the nginx configuration decisions and why each setting is configured the way it is.

## Architecture Overview

```
Internet → VPS Nginx → WireGuard Tunnel → External Ingress → Apps
```

The VPS nginx acts as a reverse proxy, forwarding traffic through a WireGuard tunnel to the home cluster's external ingress controller.

## Configuration Breakdown

### WebSocket Support (CRITICAL FIX)

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

**Why**: The original config had `proxy_set_header Connection $http_connection;` which used a non-existent variable. This caused:
- WebSocket connections to fail
- Connection headers to be malformed
- Random timeouts (7-30 seconds)
- Even non-WebSocket apps were affected

**How it works**:
- If client sends `Upgrade` header → Connection becomes "upgrade"
- If no `Upgrade` header → Connection becomes "close"
- This properly handles both WebSocket and regular HTTP traffic

### Buffering Settings

```nginx
proxy_buffering off;
proxy_request_buffering off;
```

**Why `proxy_buffering off`**:
- Nginx won't buffer responses from upstream
- Critical for streaming (Plex) - data flows immediately to client
- Reduces latency for all apps

**Why `proxy_request_buffering off`** (NEW):
- Nginx won't buffer request bodies before forwarding
- Essential for large file uploads
- Prevents timeout on slow upload connections
- Was missing in original config, causing upload issues

### Timeout Configuration

```nginx
proxy_connect_timeout 60s;
proxy_send_timeout 3600s;
proxy_read_timeout 3600s;
send_timeout 3600s;
```

**Why these values**:
- `60s connect`: Generous but not excessive for establishing connection
- `3600s (1 hour) for send/read`: Required for:
  - Long-running streaming sessions (Plex movies)
  - Large file uploads/downloads
  - Server-sent events (SSE)
  - Long-polling connections

### SSL/TLS Configuration

```nginx
proxy_pass https://{{ nginx_external_ingress_ip }}:443;
proxy_ssl_verify off;
proxy_ssl_session_reuse on;
proxy_ssl_protocols TLSv1.2 TLSv1.3;
```

**Why `proxy_ssl_verify off`**:
- Backend uses self-signed certificate
- Connection is already secure via WireGuard tunnel
- Verification would fail and break the proxy

**Why `proxy_ssl_session_reuse on`**:
- Reuses SSL sessions between requests
- Reduces SSL handshake overhead
- Improves performance for HTTPS backends

### Keep-Alive Settings

```nginx
proxy_socket_keepalive on;
```

**Why we kept this**:
- TCP socket keep-alive (different from HTTP keep-alive)
- Helps detect dead connections
- NOT the same as WireGuard's PersistentKeepalive that caused issues
- Operates at different network layer

**What we avoided**:
- No `upstream` block with `keepalive` directive
- No HTTP keep-alive headers that might trigger WireGuard issues
- No persistent connection pooling

### Header Configuration

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port 443;
```

**Why these specific headers**:
- `Host`: Preserves original hostname for virtual hosting
- `X-Real-IP`: Passes real client IP for logging/security
- `X-Forwarded-For`: Maintains full proxy chain
- `X-Forwarded-Proto`: Tells backend this is HTTPS (prevents redirect loops)
- `X-Forwarded-Host/Port`: Some apps need these for generating URLs

### TCP Optimizations

```nginx
tcp_nodelay on;
tcp_nopush on;
```

**Why both**:
- `tcp_nodelay`: Disables Nagle's algorithm, reduces latency
- `tcp_nopush`: Optimizes packet sending, improves throughput
- Together they balance latency vs throughput

### Client Settings

```nginx
client_max_body_size 100M;
client_body_buffer_size 1M;
client_body_timeout 120s;
```

**Why these values**:
- `100M max`: Allows reasonable file uploads without being excessive
- `1M buffer`: Balances memory usage vs performance
- `120s timeout`: Prevents slow upload attacks while allowing legitimate slow connections

## Security Headers

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

**Why each header**:
- `X-Frame-Options`: Prevents clickjacking
- `X-Content-Type-Options`: Prevents MIME sniffing
- `X-XSS-Protection`: Legacy XSS protection (for older browsers)
- `Referrer-Policy`: Controls referrer information leakage
- `HSTS`: Forces HTTPS for 1 year, including subdomains

## Special Considerations

### Echo Test Server Block

Separate server block for `echo-test.{{ nginx_domain }}` targeting Envoy Gateway:
- Used for testing Envoy Gateway without affecting main traffic
- Can be disabled via `enable_echo_test` variable
- Uses direct backend variable to prevent connection pooling

### Metrics Endpoints

```nginx
location /metrics/node { ... }
location /metrics/wireguard { ... }
```

- Password protected with htpasswd
- Exposes Prometheus metrics from local exporters
- Can be disabled via `enable_metrics` variable

## What We Deliberately Avoided

1. **No aggressive keep-alive**: Could trigger WireGuard tunnel flaps
2. **No connection pooling**: Upstream blocks with keepalive avoided
3. **No HTTP/2 to backend**: Potential compatibility issues
4. **No gzip compression**: Apps handle their own compression
5. **No caching**: Apps manage their own caching strategies

## Common Issues This Solves

| Issue | Root Cause | Fix |
|-------|------------|-----|
| 7-30 second timeouts | Broken WebSocket variable | Connection upgrade map |
| Streaming stutters | Missing request buffering off | Disabled all buffering |
| Upload failures | No request buffering setting | Added proxy_request_buffering off |
| Random connection drops | Malformed Connection header | Proper connection handling |
| SSL errors | Trying to verify self-signed cert | Disabled SSL verification |

## Testing the Configuration

1. **WebSocket Test**: Connect to an app using WebSockets (like a real-time dashboard)
2. **Streaming Test**: Stream a large video file through Plex
3. **Upload Test**: Upload a 50MB file to an app
4. **Long Connection Test**: Keep a SSE/long-poll connection open for 30+ minutes

## Maintenance Notes

- Configuration is idempotent - can be run repeatedly
- Automatic backups created before each deployment
- Changes should be made in Git, not on server
- Test with dry-run before applying: `ansible-playbook nginx-only.yml --check`