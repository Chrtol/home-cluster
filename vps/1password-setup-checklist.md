# 1Password Setup Checklist for Pangolin Deployment

## Required 1Password Items

### 1. `vps-wireguard` Item (in Lab vault)
This item should contain:
- **VPS_IP**: Your VPS IP address

### 2. `pangolin` Item (in Lab vault)
This item should contain:
- **PANGOLIN_VPS_SSH_PRIVATE_KEY**: Your dedicated CI/CD SSH private key (full key content)
- **PANGOLIN_DOMAIN**: `pangolin.yourdomain.com` (replace with your domain)
- **PANGOLIN_EMAIL**: Your email for Let's Encrypt certificates

## Steps to Complete

1. **Verify all 1Password items** have required fields:
   - `vps-wireguard`: VPS_IP
   - `pangolin`: PANGOLIN_VPS_SSH_PRIVATE_KEY, PANGOLIN_DOMAIN, PANGOLIN_EMAIL

2. **Add wildcard DNS** in Cloudflare:
   - CNAME: `*.pangolin.yourdomain.com` → `yourdomain.com`

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