# S3 Bucket Component

This component provides GitOps-friendly S3 bucket management for Garage, eliminating the need for manual CLI operations.

## How It Works

Instead of manually SSH'ing into pods and running Garage CLI commands, this component:

1. **Renders the Garage CLI config** (with the RPC secret from the 1Password
   `garage` item) into the app's namespace via an ExternalSecret, so the setup
   Job is self-contained and works from **any** namespace.
2. **Automatically creates the S3 bucket + access key** when you deploy an app,
   using the Garage CLI authenticated by that RPC secret.
3. **Stores the credentials** in a `${APP}-s3-credentials` Kubernetes secret.
4. **Is fully declarative** - just include the component and set variables.

## Prerequisites

None beyond a running Garage and a 1Password `garage` item containing
`GARAGE_RPC_SECRET` (already used by the Garage deployment itself). There is **no**
manual `garage-admin` key to create — the component authenticates the CLI with the
RPC secret it renders itself.

> Note: this component does **not** configure bucket CORS. Apps in this cluster
> (Zipline, Outline, Tempo, …) upload to S3 **server-side**, so browser CORS is
> unnecessary. If you ever add an app that uploads browser-direct-to-S3, set CORS
> on that bucket separately.

## Building the Helper Image

The component uses a custom image with the Garage CLI + kubectl:

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
```

This will automatically:
- Create the `myapp-data` bucket
- Generate access credentials
- Store them in `myapp-s3-credentials` secret

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