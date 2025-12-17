#!/bin/bash
# VPS Alloy Installation Script
# Run this script on your VPS after committing and pushing the Kubernetes changes

set -e

echo "=== Installing Grafana Alloy on VPS ==="

# Add Grafana APT repository
echo "Adding Grafana APT repository..."
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list

# Update and install Alloy
echo "Installing Alloy..."
sudo apt-get update
sudo apt-get install -y alloy

# Verify node-exporter is running
echo "Verifying node-exporter is running..."
if curl -s http://localhost:9100/metrics | head -5 > /dev/null; then
    echo "✓ node-exporter is running"
else
    echo "✗ node-exporter is NOT running - please install and start it first"
    exit 1
fi

# Create Alloy configuration
echo "Creating Alloy configuration..."
sudo tee /etc/alloy/config.alloy > /dev/null <<'EOF'
// Scrape node-exporter locally
prometheus.scrape "vps_node" {
  targets = [{
    __address__ = "localhost:9100",
  }]

  forward_to = [prometheus.remote_write.home_cluster.receiver]

  scrape_interval = "30s"
  scrape_timeout  = "10s"
}

// Remote write to home cluster Prometheus via dedicated LoadBalancer
prometheus.remote_write "home_cluster" {
  endpoint {
    url = "http://10.100.0.2:9090/api/v1/write"

    // Retry settings for reliable delivery
    queue_config {
      capacity             = 10000
      max_shards           = 10
      min_shards           = 1
      max_samples_per_send = 5000
      batch_send_deadline  = "5s"
      min_backoff          = "30ms"
      max_backoff          = "5s"
    }
  }

  external_labels = {
    instance = "vps",
    job      = "vps-node-exporter",
  }
}
EOF

# Validate configuration
echo "Validating Alloy configuration..."
sudo alloy fmt /etc/alloy/config.alloy

# Enable and start Alloy service
echo "Enabling and starting Alloy service..."
sudo systemctl enable alloy
sudo systemctl restart alloy

# Wait a moment for service to start
sleep 3

# Check service status
echo ""
echo "=== Alloy Service Status ==="
sudo systemctl status alloy --no-pager -l

echo ""
echo "=== Recent Alloy Logs ==="
sudo journalctl -u alloy -n 50 --no-pager

echo ""
echo "=== Setup Complete ==="
echo "Alloy is now running and pushing metrics to your home cluster."
echo "Check logs with: sudo journalctl -u alloy -f"
echo "Check Prometheus for VPS metrics: up{job=\"vps-node-exporter\"}"
