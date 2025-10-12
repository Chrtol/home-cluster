# Copilot Instructions

This document provides guidance for using AI coding agents in the `home-cluster` repository.

## 🌟 Project Overview & Architecture

This repository manages a bare-metal Kubernetes homelab using a GitOps approach.

- **Operating System**: [Talos Linux](https://www.talos.dev/) on all nodes.
- **Kubernetes**: Managed declaratively by Talos.
- **GitOps**: [FluxCD](https://fluxcd.io/) is the cornerstone of this repository. All changes to the cluster state (applications, configuration, etc.) are managed through Kubernetes manifests in this Git repository.
- **Networking**: [Cilium](https://cilium.io/) is used for the CNI, providing networking, observability, and security. BGP is used for load balancing services.
- **Storage**: [Ceph](https://ceph.io/) provides distributed block (`RBD`) and file (`CephFS`) storage, managed via `ceph-csi` drivers.
- **Secrets**: Secrets are encrypted using [SOPS](https://github.com/getsops/sops) with `age`. Encrypted files have a `.sops.yaml` extension. The `age.key` file is required for decryption.

## 🚀 Core Workflow: GitOps is Law

**The single most important rule is to never use `kubectl apply` or `helm install/upgrade` directly.**

The development workflow is as follows:
1.  **Modify Files**: Make changes to the Kubernetes manifests, Kustomizations, or HelmReleases under the `/kubernetes` directory.
2.  **Commit Changes**: Write a clear, concise commit message summarizing the change.
3.  **Push to Git**: Push the changes to the `main` branch.

FluxCD is configured with a webhook that automatically reconciles the cluster state upon a git push. There is no need to manually trigger a reconciliation.

### Example: Updating an Application

To update the `reptile-tracker` application's container image:
1.  Navigate to `/kubernetes/apps/default/reptile-tracker/app/helmrelease.yaml`.
2.  Locate the `spec.chart.spec.values.image.tag` field.
3.  Update the tag to the new version.
4.  Commit and push the change. Flux will handle the deployment.

## 📁 Key Directories

- `/kubernetes/apps/`: Contains all application manifests, organized by namespace. This is where you'll spend most of your time.
- `/kubernetes/flux/`: The core FluxCD configuration. You'll rarely need to touch this.
- `/talos/`: Talos OS configuration and machine patches. Modifications here affect the underlying nodes.
- `/apps/`: Source code for custom applications like `reptile-tracker`. When working on these, remember to also update the corresponding Kubernetes manifests if the image tag or configuration changes.

## 📝 Conventions & Patterns

- **Kustomize**: We use Kustomize extensively to manage environment-specific configurations and to patch Helm charts. Look for `kustomization.yaml` files.
- **HelmReleases**: Applications are deployed via Flux `HelmRelease` resources, not direct Helm commands. Values are often defined directly within the `HelmRelease` YAML.
- **Secrets**: When you need to add or update a secret, edit the corresponding `.sops.yaml` file. The CI/CD pipeline will handle encryption/decryption as long as the `age.key` is present. Do not commit unencrypted secrets.
- **Custom Applications**: The `reptile-tracker` (`/apps/reptile-tracker`) is a good example of a custom app in this cluster. It has a FastAPI backend and a React frontend. Development instructions are in its `README.md`, but remember that deployment is handled by the manifests in `/kubernetes/apps/default/reptile-tracker/`.

## ❌ What to Avoid

- **Do not run `task` commands.** The `Taskfile.yaml` is for bootstrapping and manual administrative tasks, not for routine development or deployment.
- **Do not run `kubectl` or `flux` commands to alter the cluster state.** Use them only for read-only operations to check status or debug issues (e.g., `flux get ks -A`, `cilium status`).
- **Do not suggest manual reconciliation.** The cluster reconciles automatically on git push.
