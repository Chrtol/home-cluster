#!/bin/bash
# Pre-deployment readiness check for Pangolin

echo "=== Pangolin Deployment Readiness Check ==="
echo ""

# Check Docker
echo "✓ Checking Docker..."
if docker --version > /dev/null 2>&1; then
    echo "  Docker is installed: $(docker --version)"
else
    echo "  ✗ Docker is not installed"
    exit 1
fi

# Check Docker Compose
echo "✓ Checking Docker Compose..."
if docker compose version > /dev/null 2>&1; then
    echo "  Docker Compose is available: $(docker compose version)"
else
    echo "  ✗ Docker Compose is not available"
    exit 1
fi

# Check Crowdsec
echo "✓ Checking Crowdsec..."
if sudo systemctl is-active --quiet crowdsec; then
    echo "  Crowdsec is running on host"
    if sudo ss -tuln | grep -q ':8080'; then
        echo "  Crowdsec API is listening on port 8080"
    else
        echo "  ⚠ Crowdsec API not found on port 8080"
    fi
else
    echo "  ⚠ Crowdsec is not running"
fi

# Check for conflicting ports
echo "✓ Checking for port conflicts..."
PORTS=(8081 8443 51821 21821)
CONFLICTS=0
for PORT in "${PORTS[@]}"; do
    if sudo ss -tuln | grep -q ":$PORT "; then
        echo "  ⚠ Port $PORT is already in use!"
        CONFLICTS=$((CONFLICTS + 1))
    else
        echo "  Port $PORT is available"
    fi
done

if [ $CONFLICTS -gt 0 ]; then
    echo ""
    echo "⚠ Warning: Some ports are already in use. Check for conflicts."
fi

# Check bouncers
echo "✓ Checking Crowdsec bouncers..."
echo "  Note: Ansible will automatically create pangolin-traefik bouncer if needed"
if sudo cscli bouncers list | grep -q pangolin-traefik; then
    echo "  pangolin-traefik bouncer already exists (will be reused)"
fi

# Check DNS (optional)
echo "✓ Checking DNS configuration..."
PANGOLIN_DOMAIN="${PANGOLIN_DOMAIN:-pangolin.example.com}"
if host "$PANGOLIN_DOMAIN" > /dev/null 2>&1; then
    echo "  Base domain resolves: $PANGOLIN_DOMAIN"
    if host "test.$PANGOLIN_DOMAIN" > /dev/null 2>&1; then
        echo "  Wildcard DNS appears to be configured"
    else
        echo "  ⚠ Wildcard DNS not configured (*.$PANGOLIN_DOMAIN)"
    fi
else
    echo "  ⚠ Base domain does not resolve: $PANGOLIN_DOMAIN"
fi

echo ""
echo "=== Pre-Deployment Checklist ==="
echo "□ 1Password items configured:"
echo "  - vps-wireguard: VPS_IP"
echo "  - pangolin: PANGOLIN_VPS_SSH_PRIVATE_KEY, PANGOLIN_DOMAIN, PANGOLIN_EMAIL"
echo "□ Wildcard DNS record created (*.$PANGOLIN_DOMAIN)"
echo "□ GitHub secret configured (OP_SERVICE_ACCOUNT_TOKEN)"
echo ""
echo "Ready to deploy? Run: git add . && git commit -m 'feat(vps): add idempotent pangolin deployment' && git push"