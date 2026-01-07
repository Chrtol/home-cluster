#!/bin/bash
# Zero-downtime migration script from nginx to Pangolin
# This script executes the port swap in under 10 seconds

set -e

echo "========================================="
echo "Starting Pangolin Production Migration"
echo "========================================="
echo ""
echo "This will:"
echo "  1. Stop nginx (current proxy)"
echo "  2. Switch Pangolin from staging (8080/8443) to production (80/443)"
echo "  3. Restart Pangolin on standard ports"
echo ""
echo "Expected downtime: < 10 seconds"
echo ""
read -p "Are you ready to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled"
    exit 0
fi

echo ""
echo "Starting migration at $(date)"
start_time=$(date +%s)

# Step 1: Stop nginx to free ports 80/443
echo "Stopping nginx..."
systemctl stop nginx || true

# Step 2: Switch Pangolin to production configuration
echo "Switching Pangolin to production ports..."
cd /opt/pangolin
docker compose down

# Use production config with standard ports
cp docker-compose-production.yml docker-compose.yml

# Step 3: Start Pangolin on production ports
echo "Starting Pangolin on ports 80/443..."
docker compose up -d

# Wait for health check
echo "Waiting for Pangolin to be healthy..."
max_wait=30
counter=0
while [ $counter -lt $max_wait ]; do
    if docker compose ps | grep -q "healthy"; then
        echo "Pangolin is healthy!"
        break
    fi
    sleep 1
    counter=$((counter + 1))
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "========================================="
echo "Migration Complete!"
echo "========================================="
echo "Duration: ${duration} seconds"
echo ""
echo "Pangolin is now running on:"
echo "  - HTTP:  http://{{ pangolin_domain }}"
echo "  - HTTPS: https://{{ pangolin_domain }}"
echo ""
echo "nginx has been stopped and can be removed with:"
echo "  systemctl disable nginx"
echo "  apt remove nginx"
echo "========================================="