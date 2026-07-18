# S3 Bucket Component

Declarative S3 bucket + credentials for an app, provisioned on the operator-managed
Garage cluster (`garage-operated` in the `database` namespace) via
[rajsinghtech/garage-operator](https://github.com/rajsinghtech/garage-operator) CRs.

## How It Works

The component (`component.yaml`) emits two operator CRs in the **app's own namespace**:

1. **`GarageBucket`** — the bucket, with `globalAlias: ${S3_BUCKET}`.
2. **`GarageKey`** — a per-app access key (minted fresh), granted `read/write/owner`
   on the bucket. Its `secretTemplate` writes **`${APP}-s3-credentials`** into the
   app namespace with keys `ACCESS_KEY`, `SECRET_KEY`, `BUCKET`, `ENDPOINT`, `REGION` —
   ready to `secretKeyRef` from the app's HelmRelease.

No Job, no helper image, no RPC secret — the operator does everything. (This replaced
an older Job/`garage-kubectl`-image version that never worked.)

## Prerequisites

- The operator + `garage-operated` cluster must be running. Depend on it:
  `dependsOn: [{ name: garage-operated-cluster, namespace: database }]`.
- A **`GarageReferenceGrant`** in `database` must permit the app's namespace to make a
  cross-namespace reference to the cluster. See
  `kubernetes/apps/database/garage/operator/cluster/referencegrant.yaml` — add the
  namespace to its `from:` list when a new namespace first adopts this component.
  (This grant is the operator's official mechanism for gating who may provision keys —
  see garage-operator issue #93.)

## Usage

```yaml
# In the app's Flux Kustomization (ks.yaml)
spec:
  components:
    - ../../../../components/s3-bucket
  dependsOn:
    - name: garage-operated-cluster
      namespace: database
  postBuild:
    substitute:
      APP: myapp
      NAMESPACE: default
      S3_BUCKET: myapp-data
```

Produces the `myapp-data` bucket and a `myapp-s3-credentials` secret in `default`.
The `ENDPOINT` is the **internal** operated service (`garage-operated.database.svc:3900`),
so this is for **server-side** S3 access (the app backend uploads/serves objects).

For multiple buckets, instantiate the component once per bucket with distinct `APP`.

## Browser-direct uploads → `s3-bucket/cors`

Apps whose **browser** uploads directly to S3 (presigned PUT) trigger a CORS preflight
the bucket must allow. The `GarageBucket` CRD has no CORS field, so additionally import
the **`s3-bucket/cors`** sub-component, which runs a `PutBucketCors` Job (stock
`aws-cli`, using the app's own `owner`-scoped key — no admin token) that self-heals on
reconcile:

```yaml
  components:
    - ../../../../components/s3-bucket
    - ../../../../components/s3-bucket/cors
  postBuild:
    substitute:
      APP: myapp
      NAMESPACE: default
      S3_BUCKET: myapp-data
      CORS_SUBDOMAIN: myapp   # origin = https://${CORS_SUBDOMAIN}.${SECRET_DOMAIN}
```

Pass the **subdomain**, not the full origin: Flux `postBuild` does not expand a
`${SECRET_DOMAIN}` nested inside a `substitute:` value, so the Job builds the origin
from `${CORS_SUBDOMAIN}` + a direct `${SECRET_DOMAIN}` reference instead.

Apps that keep S3 creds in their own secret (not `${APP}-s3-credentials`) can override
`CORS_SECRET_NAME`, `CORS_ACCESS_KEY_KEY`, `CORS_SECRET_KEY_KEY`, `CORS_ENDPOINT`
(e.g. Outline uses `outline-secret` with `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`).

Server-side-upload apps (Tempo, Zipline) and browser-**GET**-only apps (Kan — a
presigned GET is a CORS "simple request", no preflight) do **not** need the cors add-on.
