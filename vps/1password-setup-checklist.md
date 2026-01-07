# 1Password Setup Checklist for Pangolin Deployment

## Required 1Password Items

### 1. `vps-wireguard` Item (in Lab vault)
This item should contain:
- **VPS_IP**: Your VPS IP address
- **VPS_SSH_PORT**: Your SSH port (if not 22)

### 2. `pangolin` Item (in Lab vault)
This item should contain:
- **PANGOLIN_VPS_SSH_PRIVATE_KEY**: Your dedicated CI/CD SSH private key (full key content)
- **PANGOLIN_VPS_SSH_USER**: The username for deployment (e.g., `deploy` or `pangolin`)
- **PANGOLIN_DOMAIN**: Your Pangolin domain (e.g., `pangolin.yourdomain.com`)
- **PANGOLIN_EMAIL**: Your email for Let's Encrypt certificates

## Steps to Complete

1. **Create deployment user on VPS** (one-time setup):
   ```bash
   # Run the helper script to see the commands
   bash vps/create-deployment-user.sh deploy ~/.ssh/vps-pangolin-deploy.pub
   ```
   Then run the displayed commands on your VPS.

2. **Verify all 1Password items** have required fields:
   - `vps-wireguard`: VPS_IP, VPS_SSH_PORT (if not 22)
   - `pangolin`: PANGOLIN_VPS_SSH_PRIVATE_KEY, PANGOLIN_VPS_SSH_USER, PANGOLIN_DOMAIN, PANGOLIN_EMAIL

3. **Add DNS record** for your domain (replace `yourdomain.com` with your actual domain):
   - Point your domain to your VPS IP address
   - Optionally add wildcard: `*.yourdomain.com` → VPS IP

## GitHub Secret

Ensure you have this secret in your GitHub repository settings:
- **OP_SERVICE_ACCOUNT_TOKEN**: Your 1Password service account token

## Verify Everything

Run on your VPS:
```bash
# Check bouncers
sudo cscli bouncers list | grep pangolin-traefik

# Check DNS
nslookup test.pangolin.yourdomain.com
```

Once all items are in place, you can deploy with:
```bash
git add .
git commit -m "feat(vps): add pangolin auth proxy with ansible automation"
git push
```