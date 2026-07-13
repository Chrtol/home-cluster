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

## Important Notes

- All nodes are configured as both controllers and workers
- Uses external-dns to manage Cloudflare (external) and AdGuard Home on OPNSense (internal) DNS records

## Memory

- Always remember I am using FluxCD and kustomizations
- I have a webhook to reconcile on Git push so you never need to manually reconcile unless it's to fix a specific issue with hr/ks
- Storage: Proxmox Ceph for fast storage, TrueNAS via NFS for bulk/media storage
- PostgreSQL is the preferred database; use it for new apps when possible
- Never use kubectl apply since I am using FluxCD
- Never suggest to use the task commands
- Never git add or commit, always just give me a one line commit message based on the changed files in the format: "verb(app): summary", i.e. "fix(reptile-tracker): revert timezone changes in scheduler to fix notification crashes"
- To use "kubectl" or "talosctl" commands, always pre-fix your kubectl commands with "export KUBECONFIG=/home/chrto/Homelab/github/chrtol/home-cluster/kubeconfig && kubectl ... / talosctl ..."
- For reusable patterns (auth/OIDC, backup, gatus, PVC provisioning, etc.), create generalized components in `/kubernetes/components/`
- Prefer OCI repos over Helm repos for HelmReleases
- Place .md documents in `/ai-activity/`; create a topic subfolder when multiple documents are needed
- Never mention a domain in a file - always use variable substitution