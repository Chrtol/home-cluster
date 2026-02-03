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
- **Storage**: Proxmox Ceph (RBD and CephFS via CSI drivers), TrueNAS with HDDs via NFS
- **DNS**: CoreDNS with k8s_gateway for internal DNS
- **Ingress**: Envoy Gateway
- **External Access**: VPS with Traefik → WireGuard tunnel → OPNSense → Envoy Gateway
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

- `/apps/` - Custom application source code (e.g., reptile-tracker)
- `/kubernetes/apps/` - Application manifests organized by namespace
- `/kubernetes/flux/` - Flux configuration and repositories
- `/talos/` - Talos configuration and patches
- `/bootstrap/` - Initial cluster bootstrap configuration
- `/templates/` - Jinja2 templates for configuration generation
- `/vps/` - Ansible configuration for VPS (CI/CD deployed)
  - Must be declarative and idempotent
  - No hardcoded secrets, domains, or IP addresses
  - All secrets/config from 1Password integration

## Secrets Management

- Uses External Secrets with 1Password as the primary secrets backend
- SOPS with age encryption for certain in-cluster config files
- GitHub deploy key for Flux Git access

## Networking

- **Cluster Network**: 10.0.30.0/24
- **API Server**: 10.0.30.50
- **Internal Gateway**: 10.0.30.43 (Envoy Gateway)
- **External Gateway**: 10.0.30.44 (Envoy Gateway, via VPS/Traefik)
- **DNS Gateway**: 10.0.30.45 (k8s_gateway)
- **BGP**: AS 64514 peering with 10.0.30.1 (AS 64513)
- **Domains**: Same domains used internally and externally (no split DNS)

## Application Categories

- **Media**: Plex, Sonarr, Radarr, Jellyseerr, Immich, Audiobookshelf, qBittorrent, etc.
- **Monitoring**: Prometheus, Grafana, Gatus, Loki, Promtail
- **Security**: Authentik (SSO/OIDC), CrowdSec, Trivy
- **Database**: PostgreSQL (CloudNative-PG, preferred), Dragonfly (Redis-compatible), MariaDB
- **AI**: Ollama
- **Home Automation**: Home Assistant, Mosquitto, Zigbee2MQTT
- **Storage**: Ceph CSI drivers (RBD and CephFS)
- **Networking**: Cilium, Envoy Gateway, external-dns

## Important Notes

- All nodes are configured as both controllers and workers
- Uses external-dns to manage Cloudflare (external) and AdGuard Home on OPNSense (internal) DNS records
- Renovate handles dependency updates automatically
- Flux webhooks enable immediate deployment on git push
- Template system allows for easy cluster configuration changes

## Memory

- Always remember I am using FluxCD and kustomizations
- I have a webhook to reconcile on Git push so you never need to manually reconcile unless it's to fix a specific issue with hr/ks
- Storage: Proxmox Ceph for fast storage, TrueNAS via NFS for bulk/media storage
- PostgreSQL is the preferred database; use it for new apps when possible
- Never use kubectl apply since I am using FluxCD
- Never suggest to use the task commands
- Never git add or commit, always just give me a one line commit message based on the changed files in the format: "verb(app): summary", i.e. "fix(reptile-tracker): revert timezone changes in scheduler to fix notification crashes"
- To use "kubectl" commands, always pre-fix your kubectl commands with "export KUBECONFIG=/home/chrto/Homelab/github/chrtol/home-cluster/kubeconfig && kubectl ..."
- For reusable patterns (auth/OIDC, backup, gatus, PVC provisioning, etc.), create generalized components in `/kubernetes/components/`
- Prefer OCI repos over Helm repos for HelmReleases
- Place .md documents in `/ai-activity/`; create a topic subfolder when multiple documents are needed
- Never mention a domain in a file - always use variable substitution