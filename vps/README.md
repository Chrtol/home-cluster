# VPS Infrastructure as Code

This directory contains Ansible automation for VPS management.

## Playbooks

### Full VPS Setup
```bash
ansible-playbook site.yml -i inventory.yml
```

This includes:
- System hardening and automatic updates
- Docker installation
- UFW firewall configuration
- CrowdSec IDS
- Traefik reverse proxy
- Trivy security scanner (client mode, connects to cluster server)

### Traefik Reverse Proxy Only (GitOps)
```bash
ansible-playbook reverse-proxy.yml -i inventory.yml
```

Manages Traefik configuration declaratively. Triggered by GitHub Actions on push.

## Directory Structure

```
vps/
├── ansible/
│   ├── site.yml             # Full VPS setup
│   ├── reverse-proxy.yml    # Traefik GitOps playbook
│   ├── inventory.yml        # Dynamic inventory from env vars
│   └── roles/
│       ├── base/            # System configuration
│       ├── docker/          # Docker installation
│       ├── firewall/        # UFW rules
│       ├── crowdsec/        # CrowdSec IDS
│       ├── traefik/         # Traefik reverse proxy
│       └── trivy/           # Trivy security scanner
```

## Deployment

### GitHub Actions (Recommended)
```bash
git push  # Automatically triggers reverse-proxy deployment
```

### Manual Dry Run
```bash
cd vps/ansible
ansible-playbook reverse-proxy.yml -i inventory.yml --check --diff
```

### Manual Deployment
```bash
cd vps/ansible
ansible-playbook reverse-proxy.yml -i inventory.yml
```

## Required Secrets

See `1PASSWORD_SECRETS.md` in the ansible directory for configuration.
