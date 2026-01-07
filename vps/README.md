# VPS Infrastructure as Code

This directory contains Ansible automation for VPS management.

## ⚠️ Important: Existing VPS vs New VPS

### For EXISTING VPS (Your Current Situation)
Use the minimal playbook that ONLY deploys Pangolin:

```bash
# From GitHub Actions or locally
ansible-playbook pangolin-only.yml -i inventory.yml
```

This will:
- Add firewall rules for Pangolin staging ports (8081, 8443, 51821, 21821)
- Deploy Pangolin in staging mode
- NOT touch any existing services or configurations

Note: The playbook safely adds iptables rules for the staging ports without disrupting existing rules.

### For NEW VPS (Future Reference)
Use the full playbook for complete server setup:

```bash
# Complete server configuration from scratch
ansible-playbook site.yml -i inventory.yml
```

This includes:
- System hardening
- Docker installation
- Firewall configuration
- Automatic updates
- Pangolin deployment

## Directory Structure

```
vps/
├── ansible/
│   ├── pangolin-only.yml    # SAFE: Only deploys Pangolin
│   ├── site.yml             # FULL: Complete VPS setup (new servers)
│   ├── inventory.yml        # Dynamic inventory from env vars
│   └── roles/
│       ├── base/            # System configuration (FULL setup only)
│       ├── docker/          # Docker installation (FULL setup only)
│       ├── firewall/        # UFW rules (FULL setup only)
│       ├── crowdsec/        # Security (optional)
│       └── pangolin/        # Pangolin stack (used by both)
└── github-secrets-setup.md  # 1Password integration guide
```

## Deployment Options

### Option 1: GitHub Actions (Recommended)
```bash
git push  # Automatically triggers deployment
```

### Option 2: Manual Dry Run (Preview Changes)
```bash
cd vps/ansible
ansible-playbook pangolin-only.yml -i inventory.yml --check --diff
```

### Option 3: Manual Deployment
```bash
cd vps/ansible
ansible-playbook pangolin-only.yml -i inventory.yml
```

## Required Secrets

See `github-secrets-setup.md` for 1Password configuration.

## Rollback

If something goes wrong:
1. Stop Pangolin: `docker compose -f /opt/pangolin/docker-compose.yml down`
2. Remove Pangolin: `rm -rf /opt/pangolin`
3. Fix issues and redeploy

## Future Use Cases

The full `site.yml` playbook is saved for:
- Disaster recovery (new VPS from scratch)
- Testing environments
- Development VPS setup
- Documentation of ideal configuration