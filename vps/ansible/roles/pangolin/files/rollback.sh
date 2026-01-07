#!/bin/bash
# Emergency rollback script - restores nginx if Pangolin migration fails

set -e

echo "========================================="
echo "EMERGENCY ROLLBACK"
echo "========================================="
echo ""
echo "This will:"
echo "  1. Stop Pangolin"
echo "  2. Restart nginx on ports 80/443"
echo ""
read -p "Proceed with rollback? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled"
    exit 0
fi

echo "Starting rollback at $(date)"

# Stop Pangolin
echo "Stopping Pangolin..."
cd /opt/pangolin || true
docker compose down || true

# Restart nginx
echo "Starting nginx..."
systemctl start nginx

echo ""
echo "========================================="
echo "Rollback Complete!"
echo "========================================="
echo "nginx is now serving on ports 80/443"
echo "Pangolin has been stopped"
echo ""
echo "To retry migration later:"
echo "  1. Fix any issues"
echo "  2. Start Pangolin in staging mode (ports 8080/8443)"
echo "  3. Run migrate-to-production.sh when ready"
echo "========================================="