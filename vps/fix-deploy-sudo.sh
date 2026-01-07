#!/bin/bash
# Quick fix for deployment user sudo permissions

echo "=== Fixing sudo permissions for deployment user ==="
echo ""
echo "Run this command on your VPS as a user with sudo access:"
echo ""
echo "echo 'deploy ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/deploy"
echo ""
echo "This grants the deployment user passwordless sudo access for all commands,"
echo "which is required for Ansible to gather facts and perform deployments."
echo ""
echo "After running this command, re-run the GitHub Actions workflow."