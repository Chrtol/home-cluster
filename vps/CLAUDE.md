# VPS (Ansible)

Ansible configuration for the VPS, deployed via CI/CD.

- Must be declarative and idempotent
- No hardcoded secrets, domains, or public IP addresses. Private tunnel addresses are fine, but
  any address that has a key in cluster-secrets (e.g. DESKTOP_LAN_IP) is a secret here too;
  the pre-commit leak scanner enforces this
- CI logs are public: only values loaded from 1Password are masked, so never print addresses or keys
- All secrets/config from 1Password integration
