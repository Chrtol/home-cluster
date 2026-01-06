# S3 Bucket Component

This component provides GitOps-friendly S3 bucket management for Garage, eliminating the need for manual CLI operations.

## How It Works

Instead of manually SSH'ing into pods and running Garage CLI commands, this component:

1. **Automatically creates S3 buckets** when you deploy an app
2. **Generates access credentials** and stores them in Kubernetes secrets
3. **Configures CORS policies** for browser uploads
4. **Is fully declarative** - just include the component and set variables

## Initial Setup (One Time Only)

Before using this component, you need to create an admin key in Garage:

```bash
# 1. Get into the Garage pod
kubectl exec -it -n database deployment/garage -- bash

# 2. Create an admin key
/garage -c /etc/garage.toml key create garage-admin
# Note the Access Key and Secret Key from output

# 3. Grant admin permissions
/garage -c /etc/garage.toml key allow --create-bucket garage-admin

# 4. Exit the pod and create the secret
kubectl create secret generic garage-admin \
  --namespace=database \
  --from-literal=ACCESS_KEY="<access-key>" \
  --from-literal=SECRET_KEY="<secret-key>"
```

## Building the Helper Image

The component uses a custom image with Garage CLI, kubectl, and AWS CLI:

```bash
cd kubernetes/common/components/s3-bucket
docker build -t ghcr.io/<your-github>/garage-kubectl:v1.3.0 .
docker push ghcr.io/<your-github>/garage-kubectl:v1.3.0
```

## Usage Example

After initial setup, creating S3 buckets is fully declarative:

```yaml
# In your app's Kustomization
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: myapp
  namespace: flux-system
spec:
  path: ./kubernetes/apps/default/myapp/app
  components:
    - ../../../../../common/components/s3-bucket
  postBuild:
    substitute:
      APP: myapp
      NAMESPACE: default
      S3_BUCKET: myapp-data
      CORS_ORIGINS: '"https://myapp.example.com"'
```

This will automatically:
- Create the `myapp-data` bucket
- Generate access credentials
- Store them in `myapp-s3-credentials` secret
- Configure CORS for browser uploads

## Benefits

- ✅ **GitOps-friendly**: Buckets defined in manifests
- ✅ **Automated**: No manual CLI operations
- ✅ **Secure**: Credentials stored in K8s secrets
- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Uses your NAS storage**: Garage stores on your HDDs

## Migration from Manual Buckets

If you already have manually-created buckets, the component will:
- Skip bucket creation (won't duplicate)
- Skip key creation (won't duplicate)
- Only create the Kubernetes secret if missing

This makes migration seamless - just add the component and it will manage existing resources.