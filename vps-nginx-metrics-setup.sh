#!/bin/bash
# VPS nginx setup for exposing metrics endpoints
# Run this on your VPS

set -e

echo "=== Setting up nginx metrics endpoints on VPS ==="

# 1. Create nginx server block for metrics
echo "Creating nginx configuration..."
sudo tee /etc/nginx/sites-available/vps-metrics > /dev/null <<'EOF'
# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name vps.cftollefsen.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS metrics endpoints
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name vps.cftollefsen.com;

    # Wildcard certificate
    ssl_certificate /etc/letsencrypt/live/cftollefsen.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cftollefsen.com/privkey.pem;

    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    # Node exporter metrics
    location /metrics/node {
        auth_basic "Metrics Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://localhost:9100/metrics;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Wireguard exporter metrics
    location /metrics/wireguard {
        auth_basic "Metrics Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://localhost:9586/metrics;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Return 404 for all other requests
    location / {
        return 404;
    }
}
EOF

# 2. Create htpasswd file if it doesn't exist
if [ ! -f /etc/nginx/.htpasswd ]; then
    echo ""
    echo "Creating basic auth credentials..."
    echo "Enter username for metrics access:"
    read -r USERNAME
    sudo htpasswd -c /etc/nginx/.htpasswd "$USERNAME"
else
    echo "✓ /etc/nginx/.htpasswd already exists"
fi

# 3. Enable the site
echo "Enabling nginx site..."
sudo ln -sf /etc/nginx/sites-available/vps-metrics /etc/nginx/sites-enabled/vps-metrics

# 4. Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# 5. Reload nginx
echo "Reloading nginx..."
sudo systemctl reload nginx

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1. Create DNS A record: vps.cftollefsen.com -> YOUR_VPS_PUBLIC_IP"
echo "2. Test the endpoints:"
echo "   curl -u username:password https://vps.cftollefsen.com/metrics/node"
echo "   curl -u username:password https://vps.cftollefsen.com/metrics/wireguard"
echo ""
