# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Kubernetes home cluster deployment based on the onedr0p/cluster-template. It uses Talos Linux as the operating system and implements GitOps with Flux CD. The cluster includes a comprehensive set of applications for media management, monitoring, security, and networking.

## Architecture

**Core Infrastructure:**
- **Operating System**: Talos Linux on bare metal nodes
- **Kubernetes**: Deployed via Talos with 3 controller nodes (lenovo1, lenovo2, dell1)
- **GitOps**: Flux CD for cluster state management
- **Networking**: Cilium CNI with BGP load balancing
- **Storage**: Ceph RBD and CephFS via CSI drivers
- **DNS**: CoreDNS with k8s_gateway for internal DNS
- **Ingress**: nginx-ingress controllers (internal and external)
- **Certificates**: cert-manager with Let's Encrypt

**Template System:**
- Uses makejinja to render Jinja2 templates from cluster.yaml and nodes.yaml
- Templates are in `/templates/` directory with `.j2` suffix
- Configuration is rendered to actual Kubernetes manifests

**Cluster Configuration:**
- Main config: `cluster.yaml` - defines cluster settings, networking, and domains
- Node config: `nodes.yaml` - defines individual node specifications
- Network: 10.0.30.0/24 with API server at 10.0.30.50

## Common Commands

### Initial Setup
```bash
# Initialize configuration files
task init

# Configure and render templates
task configure
```

### Cluster Management
```bash
# Bootstrap Talos cluster
task bootstrap:talos

# Bootstrap applications
task bootstrap:apps

# Force Flux reconciliation
task reconcile
```

### Talos Operations
```bash
# Generate Talos configuration
task talos:generate-config

# Apply config to specific node
task talos:apply-node IP=10.0.30.100 MODE=auto

# Upgrade Talos on a node
task talos:upgrade-node IP=10.0.30.100

# Upgrade Kubernetes cluster
task talos:upgrade-k8s

# Reset cluster (destructive)
task talos:reset
```

### Template Management
```bash
# Render configuration templates
task template:render-configs

# Validate configurations
task template:validate-schemas

# Clean up template files after deployment
task template:tidy
```

### Debugging
```bash
# Gather cluster resources
task template:debug

# Check Flux status
flux check
flux get sources git -A
flux get ks -A
flux get hr -A

# Check Cilium status
cilium status
```

## Key Directories

- `/kubernetes/apps/` - Application manifests organized by namespace
- `/kubernetes/flux/` - Flux configuration and repositories
- `/talos/` - Talos configuration and patches
- `/bootstrap/` - Initial cluster bootstrap configuration
- `/templates/` - Jinja2 templates for configuration generation

## Secrets Management

- Uses SOPS with age encryption for secrets
- Age key stored in `age.key` file
- Encrypted files have `.sops.yaml` extension
- GitHub deploy key for Flux Git access

## Networking

- **Cluster Network**: 10.0.30.0/24
- **API Server**: 10.0.30.50
- **Internal Ingress**: 10.0.30.40
- **External Ingress**: 10.0.30.60
- **DNS Gateway**: 10.0.30.45
- **BGP**: AS 64514 peering with 10.0.30.1 (AS 64513)

## Application Categories

- **Media**: Plex, Sonarr, Radarr, Jellyseerr, Immich, etc.
- **Monitoring**: Prometheus, Grafana, Gatus
- **Security**: Authentik, Authelia, LLDAP
- **Database**: PostgreSQL (CloudNative-PG), Redis
- **Storage**: Ceph CSI drivers
- **Networking**: Cilium, external-dns, cloudflared

## Important Notes

- All nodes are configured as both controllers and workers
- Uses Cloudflare for external DNS and tunnel access
- Renovate handles dependency updates automatically
- Flux webhooks enable immediate deployment on git push
- Template system allows for easy cluster configuration changes

## Development Workflow

1. Modify `cluster.yaml` or `nodes.yaml` for configuration changes
2. Run `task configure` to render templates and validate
3. Commit and push changes to trigger Flux reconciliation
4. Use `task reconcile` to force immediate sync if needed

## Memory

- Always remember I am using FluxCD and kustomizations
- I have a webhook to reconcile on Git push so you never need to manually reconcile unless it's to fix a specific issue with hr/ks
- Write a short commit message when making changes that can be used together with the changes
- I am using Proxmox Ceph and a NAS with HDDs as storage
- Never use kubectl apply since I am using FluxCD
- Always write a summary of what has been changed that I can add to a commit message
- Never suggest to use the task commands
- Never git add or commit, always just give me a one line commit message based on the changed files in the format: "verb(app): summary", i.e. "fix(reptile-tracker): revert timezone changes in scheduler to fix notification crashes"