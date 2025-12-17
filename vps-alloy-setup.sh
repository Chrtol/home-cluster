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

# Install wireguard-exporter from GitHub releases
echo "Installing prometheus-wireguard-exporter..."
WIREGUARD_EXPORTER_VERSION="3.6.6"
wget -q https://github.com/MindFlavor/prometheus_wireguard_exporter/releases/download/${WIREGUARD_EXPORTER_VERSION}/prometheus_wireguard_exporter_${WIREGUARD_EXPORTER_VERSION}_linux_amd64.tar.gz -O /tmp/wireguard-exporter.tar.gz
sudo tar -xzf /tmp/wireguard-exporter.tar.gz -C /usr/local/bin/
sudo chmod +x /usr/local/bin/prometheus_wireguard_exporter
rm /tmp/wireguard-exporter.tar.gz

# Create systemd service
echo "Creating wireguard-exporter systemd service..."
sudo tee /etc/systemd/system/prometheus-wireguard-exporter.service > /dev/null <<'SERVICE'
[Unit]
Description=Prometheus Wireguard Exporter
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/prometheus_wireguard_exporter -n /etc/wireguard/wg0.conf
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
SERVICE

# Reload systemd and enable the service
sudo systemctl daemon-reload
sudo systemctl enable prometheus-wireguard-exporter
sudo systemctl restart prometheus-wireguard-exporter

# Wait for service to start
sleep 2

# Verify wireguard-exporter is running
echo "Verifying wireguard-exporter is running..."
if curl -s http://localhost:9586/metrics | grep -q wireguard; then
    echo "✓ wireguard-exporter is running"
else
    echo "⚠ wireguard-exporter may not be running correctly"
    echo "Check logs with: sudo journalctl -u prometheus-wireguard-exporter -n 20"
fi

# Create Alloy configuration
echo "Creating Alloy configuration..."
sudo tee /etc/alloy/config.alloy > /dev/null <<'EOF'
// Scrape node-exporter locally
prometheus.scrape "vps_node" {
  targets = [{
    __address__ = "localhost:9100",
  }]

  forward_to = [prometheus.relabel.add_node_labels.receiver]

  scrape_interval = "30s"
  scrape_timeout  = "10s"
}

// Scrape wireguard-exporter locally
prometheus.scrape "vps_wireguard" {
  targets = [{
    __address__ = "localhost:9586",
  }]

  forward_to = [prometheus.relabel.add_wireguard_labels.receiver]

  scrape_interval = "30s"
  scrape_timeout  = "10s"
}

// Relabel node-exporter metrics to set proper instance and job labels
prometheus.relabel "add_node_labels" {
  forward_to = [prometheus.remote_write.home_cluster.receiver]

  rule {
    target_label = "instance"
    replacement  = "vps"
  }

  rule {
    target_label = "job"
    replacement  = "vps-node-exporter"
  }
}

// Relabel wireguard metrics to set proper job label
prometheus.relabel "add_wireguard_labels" {
  forward_to = [prometheus.remote_write.home_cluster.receiver]

  rule {
    target_label = "job"
    replacement  = "wireguard-exporter"
  }
}

// Remote write to home cluster Prometheus via dedicated LoadBalancer
prometheus.remote_write "home_cluster" {
  endpoint {
    url = "http://10.0.30.91:9090/api/v1/write"

    // Retry settings for reliable delivery over Wireguard (reduced batch size for MTU)
    queue_config {
      capacity             = 2500
      max_shards           = 2
      min_shards           = 1
      max_samples_per_send = 100
      batch_send_deadline  = "5s"
      min_backoff          = "1s"
      max_backoff          = "30s"
    }
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
