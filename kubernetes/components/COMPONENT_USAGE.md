# Reusable Components Usage Guide

This guide explains how to use the reusable components for common deployment patterns.

## OIDC Application Component

The OIDC component automatically creates an Authentik OIDC provider with access control for your applications.

### What it creates:
1. **OIDC Provider** - Configures OAuth2/OIDC authentication
2. **Application Groups** - Creates and binds `${APP}-users` group, also binds `authentik Admins`
3. **Client Credentials** - Auto-generates and stores in `${APP}-oidc-authentik-application` secret

### Access Control:
Access is controlled through group bindings. Users must be in a group that's bound to the application to authenticate. By default:
- `${APP}-users` group is created for app-specific access
- `authentik Admins` group is automatically bound (admins always have access)

### How to use:

1. **In your app's Kustomization** (`/kubernetes/apps/default/{app}/ks.yaml`):

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: myapp
  namespace: flux-system
spec:
  # ... other config ...
  path: ./kubernetes/apps/default/myapp/app
  components:
    # Include the OIDC component
    - ../../../../../common/components/oidc-application
  postBuild:
    substitute:
      # Required variables
      APP: myapp                    # Application identifier (used in groups, policies, etc.)
      SUBDOMAIN: myapp              # Subdomain for the application
      GROUP: "Productivity"         # Authentik UI group category
      DESCRIPTION: "My Application" # Human-readable description
      REDIRECT_URL: "https://myapp.${SECRET_DOMAIN}/auth/callback/oidc"

      # Optional variables
      ICON_URL: ""                  # Icon URL for Authentik UI (optional)

  # Optional: Bind additional groups beyond the defaults
  # Only needed if you want to grant access to more groups than ${APP}-users and authentik Admins
  patches:
    - target:
        kind: HelmRelease
        labelSelector: homelab/auth-component=true  # Matches the OIDC HelmRelease
      patch: |
        - op: add
          path: '/spec/values/blueprint/groups/-'
          value:
            slug: "media-users"  # Example: also grant media-users access
            bindID: "$(uuidgen)"  # Generate unique ID
```

2. **In your app's HelmRelease**, reference the generated secret:

```yaml
env:
  OIDC_CLIENT_ID:
    secretKeyRef:
      name: ${APP}-oidc-authentik-application
      key: clientID
  OIDC_CLIENT_SECRET:
    secretKeyRef:
      name: ${APP}-oidc-authentik-application
      key: clientSecret
  OIDC_ISSUER: "https://sso.${SECRET_DOMAIN}/application/o/${APP}/"
  OIDC_AUTH_URI: "https://sso.${SECRET_DOMAIN}/application/o/authorize/"
  OIDC_TOKEN_URI: "https://sso.${SECRET_DOMAIN}/application/o/token/"
  OIDC_USERINFO_URI: "https://sso.${SECRET_DOMAIN}/application/o/userinfo/"
```

3. **Managing Access**:
   - Users must be in a group that's bound to the application to authenticate
   - Add users to the `${APP}-users` group to grant app-specific access
   - `authentik Admins` automatically have access to all applications
   - Use patches to bind additional groups if needed

   **Important**: With the authentik-application chart, group bindings control BOTH authentication AND dashboard visibility. Only users in bound groups can access the application.

### Example: KAN Application

```yaml
# /kubernetes/apps/default/kan/ks.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: kan
  namespace: flux-system
spec:
  interval: 30m
  path: ./kubernetes/apps/default/kan/app
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  targetNamespace: default
  components:
    - ../../../../../common/components/oidc-application
  postBuild:
    substitute:
      APP: kan
      SUBDOMAIN: kan
      GROUP: "Productivity"
      DESCRIPTION: "Kanban Board"
      REDIRECT_URL: "https://kan.${SECRET_DOMAIN}/api/auth/oauth2/callback/oidc"
```

### Common Redirect URL Patterns

Different applications use different callback URL patterns:

- **Outline**: `https://${SUBDOMAIN}.${SECRET_DOMAIN}/auth/oidc.callback`
- **KAN**: `https://${SUBDOMAIN}.${SECRET_DOMAIN}/api/auth/oauth2/callback/oidc`
- **Generic**: `https://${SUBDOMAIN}.${SECRET_DOMAIN}/oauth/callback`
- **Grafana**: `https://${SUBDOMAIN}.${SECRET_DOMAIN}/login/generic_oauth`

Always check your application's documentation for the correct callback URL format.

## S3 Bucket Component

The S3 bucket component automatically creates and configures S3 buckets in Garage with GitOps-friendly declarative management.

### What it creates:
1. **S3 Bucket** - Automatically provisioned in Garage
2. **Access Credentials** - Auto-generated and stored in `${APP}-s3-credentials` secret
3. **CORS Policy** - Configured if `CORS_ORIGINS` is provided
4. **Kubernetes Secret** with:
   - `ACCESS_KEY` - S3 access key
   - `SECRET_KEY` - S3 secret key
   - `BUCKET` - Bucket name
   - `ENDPOINT` - S3 endpoint URL
   - `REGION` - S3 region

### Prerequisites:
1. Garage must be deployed and running
2. A `garage-admin` secret must exist in the database namespace with admin credentials

### How to use:

1. **In your app's Kustomization** (`/kubernetes/apps/default/{app}/ks.yaml`):

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: myapp
  namespace: flux-system
spec:
  # ... other config ...
  path: ./kubernetes/apps/default/myapp/app
  components:
    # Include the S3 bucket component
    - ../../../../../common/components/s3-bucket
  postBuild:
    substitute:
      # Required variables
      APP: myapp                    # Application identifier
      NAMESPACE: default            # Target namespace
      S3_BUCKET: myapp-data        # Bucket name

      # Optional: CORS for browser uploads
      CORS_ORIGINS: '"https://myapp.${SECRET_DOMAIN}"'  # JSON array format
```

2. **In your app's HelmRelease**, reference the generated secret:

```yaml
env:
  S3_ACCESS_KEY:
    secretKeyRef:
      name: ${APP}-s3-credentials
      key: ACCESS_KEY
  S3_SECRET_KEY:
    secretKeyRef:
      name: ${APP}-s3-credentials
      key: SECRET_KEY
  S3_BUCKET:
    secretKeyRef:
      name: ${APP}-s3-credentials
      key: BUCKET
  S3_ENDPOINT:
    secretKeyRef:
      name: ${APP}-s3-credentials
      key: ENDPOINT
  S3_REGION:
    secretKeyRef:
      name: ${APP}-s3-credentials
      key: REGION
```

### Example: Application with Multiple Buckets

If your app needs multiple buckets (e.g., KAN with avatars and attachments):

```yaml
# Create two separate Kustomizations for each bucket
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: kan-avatars-bucket
  namespace: flux-system
spec:
  path: ./kubernetes/apps/default/kan/app
  components:
    - ../../../../../common/components/s3-bucket
  postBuild:
    substitute:
      APP: kan-avatars
      NAMESPACE: default
      S3_BUCKET: kan-avatars
      CORS_ORIGINS: '"https://kan.${SECRET_DOMAIN}"'
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: kan-attachments-bucket
  namespace: flux-system
spec:
  path: ./kubernetes/apps/default/kan/app
  components:
    - ../../../../../common/components/s3-bucket
  postBuild:
    substitute:
      APP: kan-attachments
      NAMESPACE: default
      S3_BUCKET: kan-attachments
      CORS_ORIGINS: '"https://kan.${SECRET_DOMAIN}"'
```

### Notes:
- The Job runs as a PostSync hook, so buckets are created after the app deploys
- Credentials are stored in Kubernetes secrets for easy consumption
- The Job is idempotent - it won't recreate existing buckets or keys
- CORS configuration uses AWS CLI format (JSON array of origins)

## Database Component (Coming Soon)

Will provide automated PostgreSQL database provisioning with CloudNative-PG.

## Troubleshooting

### OIDC Issues

1. **Certificate not found**: Ensure the Authentik certificates are created:
   ```bash
   kubectl get certificate -n security authentik-cert
   ```

2. **Secret not created**: Check if the OIDC HelmRelease is deployed:
   ```bash
   kubectl get hr -n {namespace} {app}-oidc
   kubectl get secret -n {namespace} {app}-oidc-authentik-application
   ```

3. **Access denied**: Verify user is in the correct group:
   - Check in Authentik UI under Directory > Groups
   - User should be in either `{app}-users` or `authentik Admins`

### Flux Substitution Issues

Check if variables are being substituted correctly:
```bash
flux get ks {app} -o yaml | grep postBuild -A 20
```