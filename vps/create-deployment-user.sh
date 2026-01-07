#!/bin/bash
# Script to create a dedicated deployment user on the VPS

# Configuration
DEPLOY_USER="${1:-deploy}"
SSH_PUB_KEY_FILE="${2:-~/.ssh/vps-pangolin-deploy.pub}"

echo "=== Creating Deployment User for Pangolin ==="
echo ""
echo "This script will create user: $DEPLOY_USER"
echo "Using SSH public key from: $SSH_PUB_KEY_FILE"
echo ""

if [ ! -f "$SSH_PUB_KEY_FILE" ]; then
    echo "❌ SSH public key file not found: $SSH_PUB_KEY_FILE"
    echo "   Generate it first with: ssh-keygen -t ed25519 -f ~/.ssh/vps-pangolin-deploy"
    exit 1
fi

SSH_PUB_KEY=$(cat "$SSH_PUB_KEY_FILE")

echo "Commands to run on your VPS (as a user with sudo):"
echo "=========================================="
cat << 'EOF'
# Create the deployment user
sudo adduser --disabled-password --gecos "" deploy

# Add to docker group (for Docker operations)
sudo usermod -aG docker deploy

# Create SSH directory
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh

# Add the SSH public key
EOF
echo "echo '$SSH_PUB_KEY' | sudo tee /home/deploy/.ssh/authorized_keys"
cat << 'EOF'

# Set correct permissions
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh

# Grant sudo permissions for deployment operations
echo 'deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose, /usr/sbin/cscli, /usr/bin/systemctl' | sudo tee /etc/sudoers.d/deploy

# Test the connection (from your local machine)
EOF
echo "ssh -i ~/.ssh/vps-pangolin-deploy $DEPLOY_USER@YOUR_VPS_IP 'docker --version'"
echo "=========================================="
echo ""
echo "After running these commands:"
echo "1. Update 1Password 'pangolin' item:"
echo "   - PANGOLIN_VPS_SSH_USER = $DEPLOY_USER"
echo ""
echo "2. Test the connection from your local machine:"
echo "   ssh -i ~/.ssh/vps-pangolin-deploy $DEPLOY_USER@YOUR_VPS_IP"