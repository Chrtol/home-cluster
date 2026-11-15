#!/usr/bin/env bash
# Emits dummy cluster-secrets for flate's --supply. flate >= 0.7 treats SOPS
# values as absent, so ${SECRET_*} would render empty and fail chart schemas
# (e.g. app-template cronjob timeZone must be a string). Reserved names
# (.invalid, TEST-NET) keep hostname and IP patterns valid.
#
# Every namespace folder under kubernetes/apps pulls cluster-secrets in via
# components/common, and Kustomizations read substituteFrom from their own
# namespace, so one copy per namespace.
set -euo pipefail

sed -n 's/^namespace: *//p' kubernetes/apps/*/kustomization.yaml | sort -u |
  while read -r ns; do
    cat <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: cluster-secrets
  namespace: ${ns}
stringData:
  SECRET_DOMAIN: example.invalid
  SECRET_DOMAIN_NAME: example
  SECRET_TIMEZONE: Etc/UTC
  VPS_PUBLIC_IP: 192.0.2.1
  DESKTOP_LAN_IP: 192.0.2.2
  FORGE_GIT_HOST: git.example.invalid
  FORGE_API_HOST: api.example.invalid
  FORGE_MACHINE_USER: ci
  FORGE_COMMIT_EMAIL: ci@example.invalid
EOF
  done
