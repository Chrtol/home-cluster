# Reptile Tracker Deployment Guide

This guide walks through deploying the Reptile Tracker application to your Kubernetes cluster.

## Prerequisites

1. Kubernetes cluster with Flux CD installed
2. CloudNative-PG operator installed
3. cert-manager for TLS certificates
4. Authentik for OIDC authentication
5. SOPS for secret encryption

## Step 1: Configure Authentik

1. Log in to your Authentik admin panel
2. Create a new OAuth2/OIDC Provider:
   - Name: `Reptile Tracker`
   - Client ID: `reptile-tracker`
   - Client Secret: Generate a secure secret
   - Redirect URIs: `https://reptile-tracker.YOUR_DOMAIN/auth/callback`
   - Scopes: `openid`, `email`, `profile`

3. Create an Application:
   - Name: `Reptile Tracker`
   - Slug: `reptile-tracker`
   - Provider: Select the provider created above

4. Note down:
   - Client ID
   - Client Secret
   - Discovery URL: `https://authentik.YOUR_DOMAIN/application/o/reptile-tracker/.well-known/openid-configuration`

## Step 2: Encrypt Secrets

1. **Database Secrets** (`kubernetes/apps/reptile-tracker/database/secret.sops.yaml`):

```bash
cd kubernetes/apps/reptile-tracker/database

# Edit the secret file with your values
# - Generate a secure password for PostgreSQL
# - Add your S3 credentials for backups (if using)

# Encrypt with SOPS
sops -e -i secret.sops.yaml
```

2. **Application Secrets** (`kubernetes/apps/reptile-tracker/app/secret.sops.yaml`):

```bash
cd kubernetes/apps/reptile-tracker/app

# Edit the secret file with:
# - Database URL (update after PostgreSQL is deployed)
# - Generate a secure JWT secret key (e.g., openssl rand -hex 32)
# - Your Authentik OIDC credentials

# Example values:
# database-url: postgresql+asyncpg://reptile_tracker:YOUR_PASSWORD@reptile-tracker-postgres-rw.database.svc.cluster.local:5432/reptile_tracker
# secret-key: YOUR_GENERATED_JWT_SECRET
# oidc-client-id: reptile-tracker
# oidc-client-secret: YOUR_AUTHENTIK_CLIENT_SECRET
# oidc-discovery-url: https://authentik.YOUR_DOMAIN/application/o/reptile-tracker/.well-known/openid-configuration

# Encrypt with SOPS
sops -e -i secret.sops.yaml
```

## Step 3: Update Domain Configuration

Edit `kubernetes/apps/reptile-tracker/app/helmrelease.yaml` and update:

```yaml
OIDC_REDIRECT_URI: "https://reptile-tracker.YOUR_DOMAIN/auth/callback"
FRONTEND_URL: "https://reptile-tracker.YOUR_DOMAIN"
```

Make sure the ingress host matches:
```yaml
hosts:
  - host: "reptile-tracker.${SECRET_DOMAIN}"
```

## Step 4: Commit and Push

```bash
git add .
git commit -m "feat: Add Reptile Tracker application

- FastAPI backend with PostgreSQL
- React frontend with Tailwind CSS
- OIDC authentication with Authentik
- Multi-user access control
- Feeding tracking with nutritional data
- Weight tracking with graphs
- Health records management
- Webhook notifications support"

git push
```

## Step 5: Monitor Deployment

1. Check Flux kustomizations:
```bash
flux get ks -A | grep reptile-tracker
```

2. Watch the database deployment:
```bash
kubectl get cluster -n database reptile-tracker-postgres -w
kubectl get pods -n database -l cnpg.io/cluster=reptile-tracker-postgres
```

3. Watch the application deployment:
```bash
kubectl get pods -n default -l app.kubernetes.io/name=reptile-tracker-app -w
```

4. Check logs:
```bash
# Backend logs
kubectl logs -n default -l app.kubernetes.io/instance=backend -f

# Frontend logs
kubectl logs -n default -l app.kubernetes.io/instance=frontend -f
```

## Step 6: Initialize Database

Once the backend pod is running, seed the database with default data:

```bash
# Get the backend pod name
BACKEND_POD=$(kubectl get pods -n default -l app.kubernetes.io/instance=backend -o jsonpath='{.items[0].metadata.name}')

# Exec into the pod and run seed script
kubectl exec -n default $BACKEND_POD -- python -c "
import asyncio
from app.database import async_session_maker
from app.seed_data import seed_database
asyncio.run(seed_database(async_session_maker()))
"
```

## Step 7: Access the Application

1. Wait for the ingress to be ready:
```bash
kubectl get ingress -n default reptile-tracker
```

2. Access the application:
```
https://reptile-tracker.YOUR_DOMAIN
```

3. Log in with your Authentik credentials

## Troubleshooting

### Database not starting

Check the cluster status:
```bash
kubectl describe cluster -n database reptile-tracker-postgres
kubectl get events -n database --sort-by='.lastTimestamp'
```

### Backend pod crashing

Check logs:
```bash
kubectl logs -n default -l app.kubernetes.io/instance=backend --previous
```

Common issues:
- Database connection string incorrect
- OIDC configuration missing or wrong
- Secret key not set

### Frontend not loading

Check nginx logs:
```bash
kubectl logs -n default -l app.kubernetes.io/instance=frontend
```

### Authentication not working

1. Verify Authentik configuration
2. Check redirect URI matches exactly
3. Verify OIDC discovery URL is accessible
4. Check backend logs for auth errors

### Images not pulling

The GitHub Actions workflow will build and push images on commit. Ensure:
1. Workflow has run successfully
2. Images are published to GHCR
3. Image pull policy is set correctly

## Post-Deployment

### Create Your First Reptile

1. Log in to the application
2. Navigate to "Reptiles"
3. Click "Add Reptile"
4. Fill in the details:
   - Name
   - Species
   - Date of birth
   - Feeding schedule

### Set Up Notifications

1. Go to Profile/Settings
2. Configure webhook:
   - Discord: Get webhook URL from Discord channel settings
   - Pushover: Use Pushover API endpoint with your credentials
3. Enable notifications

### Grant Access to Other Users

1. Navigate to a reptile's detail page
2. Click "Manage Access"
3. Enter user email and select access level:
   - **Owner**: Full control
   - **Feeder**: Can log feedings and weight
   - **Viewer**: Read-only access

## Backup and Restore

### Database Backups

CloudNative-PG automatically creates backups according to the retention policy (14 days).

To restore from backup:
```bash
# List available backups
kubectl cnpg backup list reptile-tracker-postgres -n database

# Restore from backup (update the timestamp)
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: reptile-tracker-postgres-restore
  namespace: database
spec:
  instances: 3
  bootstrap:
    recovery:
      source: reptile-tracker-postgres
      recoveryTarget:
        targetTime: "2025-01-01T00:00:00Z"
EOF
```

### Export Data

Use pg_dump to export data:
```bash
kubectl exec -n database reptile-tracker-postgres-1 -- pg_dump -U reptile_tracker reptile_tracker > backup.sql
```

## Updating the Application

### Update Backend

1. Make changes to backend code
2. Commit and push
3. GitHub Actions will build new image
4. Flux will deploy automatically (if using `latest` tag)

### Update Frontend

Same process as backend.

### Manual Update

If not using `latest` tag:
```bash
# Update image tag in helmrelease.yaml
# Then commit and push
git add kubernetes/apps/reptile-tracker/app/helmrelease.yaml
git commit -m "chore: Update reptile-tracker to v1.2.3"
git push
```

## Monitoring

### Prometheus Metrics

CloudNative-PG exposes metrics automatically. Check Grafana for:
- Database connection pool
- Query performance
- Storage usage

### Application Metrics

Backend exposes `/metrics` endpoint for Prometheus scraping.

### Alerts

Set up alerts for:
- Database high connections
- Pod restarts
- High memory usage
- Failed authentication attempts

## Security Considerations

1. **Secrets**: All secrets are encrypted with SOPS
2. **OIDC**: Authentication handled by Authentik
3. **HTTPS**: TLS certificates managed by cert-manager
4. **Network Policies**: Consider adding network policies to restrict traffic
5. **RBAC**: Application uses Kubernetes RBAC

## Support

For issues or questions:
1. Check application logs
2. Review Flux reconciliation status
3. Open an issue in the repository
