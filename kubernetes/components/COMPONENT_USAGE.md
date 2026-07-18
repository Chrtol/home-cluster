# Reusable Components Usage Guide

Kustomize `Component`s under `kubernetes/components/` that apps pull in via their
Flux Kustomization (`ks.yaml`). They are driven by Flux post-build variable
substitution:

```yaml
# kubernetes/apps/<ns>/<app>/ks.yaml
spec:
  components:
    - ../../../../components/<name>
  postBuild:
    substitute:
      APP: *app
      # component-specific variables, see each section
```

Conventions that apply to every component:

- `APP` is always required; most other variables default to `${APP}` via nested
  defaults (`${VAR:=${APP}}`), so the common case needs no extra variables.
- Components render into the app's namespace (`targetNamespace` on the ks). A
  component can never create cross-namespace resources.
- Components cannot patch paths containing `${APP}` (kustomize patches run before
  substitution). Components that need to change HelmRelease values therefore ship
  a values-fragment ConfigMap the app references via `spec.valuesFrom`.
- Never use an empty string as a variable default (`${VAR:=}`): kustomize strips
  quotes at build time and the empty substitution renders as YAML `null`.

| Component | Purpose | Extra wiring in the app |
|---|---|---|
| `cnpg` | Postgres init + client label | `valuesFrom` in HelmRelease |
| `dragonfly` | Dragonfly client label | `valuesFrom` in HelmRelease |
| `cnpg-tls` | Mirror CNPG CA for TLS verification (dormant) | mount `cnpg-ca` secret |
| `volsync` | Restic backup of the app PVC | none |
| `ceph-rbd` | RWO PVC on Ceph RBD | reference the PVC |
| `cephfs` | PVC on CephFS | reference the PVC |
| `gatus/external` | HTTP uptime check | none |
| `gatus/guarded` | public-DNS leak canary | none |
| `oidc-application` | Authentik OIDC provider + groups | consume generated secret |
| `proxy-application` | Authentik proxy provider | none |
| `ext-auth` | HTTPRoute + Envoy ext-auth via Authentik | none (replaces app route) |
| `s3-bucket` | Garage bucket + key (operator CRs) on garage-operated | consume `${APP}-s3-credentials` |
| `s3-bucket/cors` | PutBucketCors Job (browser-upload apps) | opt-in add-on; set `CORS_SUBDOMAIN` |
| `repos/app-template` | app-template OCIRepository | `chartRef` |
| `common` | namespace + cluster secrets | used by namespace kustomizations |

---

## Database: `cnpg`

Replaces the hand-rolled `postgres-init` initContainer and `INIT_POSTGRES_*`
ExternalSecret block. Creates:

1. **ExternalSecret** `${APP}-initdb` → secret `${APP}-initdb-secret` with
   `INIT_POSTGRES_{DBNAME,HOST,PORT,USER,PASS,SUPER_PASS}`.
2. **ConfigMap** `${APP}-cnpg-values` — an app-template values fragment that adds
   the `init-db` initContainer (image pinned once, Renovate-annotated) and stamps
   the `db.home.arpa/postgres: "true"` pod label via `defaultPodOptions.labels`.

The pod label is the access mechanism: the CNPG NetworkPolicy admits port 5432
only from pods carrying it, so pulling in this component grants database access
by construction — no policy edits per app.

### Variables

| Variable | Default | When to override |
|---|---|---|
| `APP` | — | always required |
| `DB_NAME` | `${APP}` | multi-DB apps (space-separated: `radarr_main radarr_log`) or non-app-named DBs (`paperless-main`) |
| `DB_USER` | `${APP}` | role name differs from app (`readarrbooks`, `reptiletracker`) |
| `DB_OP_ITEM` | `cloudnative-pg` | app has its own 1Password item holding its DB password |
| `DB_PASS_FIELD` | `POSTGRES_PASS` | field name inside `DB_OP_ITEM`, e.g. `KAN_POSTGRES_PASS` |
| `DB_CONTROLLER` | `${APP}` | app-template controller key differs (immich's is `server`) |

### How to use

`ks.yaml`:

```yaml
spec:
  components:
    - ../../../../components/cnpg
  postBuild:
    substitute:
      APP: *app
      DB_OP_ITEM: *app                  # app's own 1Password item
      DB_PASS_FIELD: MYAPP_POSTGRES_PASS
```

`helmrelease.yaml` — reference the values fragment and remove the local
initContainer + `INIT_POSTGRES_*` keys:

```yaml
spec:
  valuesFrom:
    - kind: ConfigMap
      name: ${APP}-cnpg-values
```

The app's own `values:` merge over the fragment, so anything it defines
(including a replacement `initContainers.init-db`) wins.

### Edge cases

- **`INIT_POSTGRES_USER_FLAGS` / `INIT_POSTGRES_EXTENSIONS`** are deliberately
  not parameterised (empty defaults render as YAML null). immich keeps them in
  its own secret and overrides the initContainer `envFrom` list in its values.
  Note: the current postgres-init image ignores `INIT_POSTGRES_EXTENSIONS`
  entirely — immich's extensions exist from an older image; a from-scratch
  restore must create them manually.
- **Apps not on app-template** (homarr, grafana) can use the ExternalSecret but
  must wire the initContainer and pod label through their own chart values.
- **Shared `app` role**: grafana/mealie/authentik/lldap historically connect as
  the shared `app` role (password = `POSTGRES_PASS` in the `cloudnative-pg`
  item, which is also this component's default). They are being split into
  per-app roles as they migrate onto this component.

### Verification after migrating an app

A rendered manifest is not proof and pod status is not proof (see
`ai-activity/cnpg-tls-audit/STATUS.md`). Confirm on the wire:

```bash
kubectl exec -n database <postgres17-primary> -c postgres -- \
  psql -U postgres -tAc "SELECT DISTINCT datname, usename, client_addr FROM pg_stat_activity WHERE datname = '<db>'"
```

## Database: `dragonfly`

Declares "this app is a Dragonfly client". Creates **ConfigMap**
`${APP}-dragonfly-values` stamping the `db.home.arpa/dragonfly: "true"` pod
label; the `dragonfly-allow-clients` NetworkPolicy admits port 6379 from pods
carrying it. Same `valuesFrom` wiring as `cnpg`:

```yaml
spec:
  components:
    - ../../../../components/dragonfly
  # helmrelease.yaml:
  valuesFrom:
    - kind: ConfigMap
      name: ${APP}-dragonfly-values
```

`REDIS_URL`s stay hand-written in each app's ExternalSecret (apps consume redis
config in incompatible shapes). Logical DB indexes are manually assigned — check
`redis-cli info keyspace` on `dragonfly-0` for collisions before picking one.
The dragonfly-operator regenerates its own same-namespace-only policy on 6379;
the repo-managed policy is additive alongside it — never replace the
operator-managed one.

## Database: `cnpg-tls` (dormant)

Mirrors the CNPG CA (`postgres17-ca`) into the app's namespace as secret
`cnpg-ca`, via the `cnpg-ca` ClusterSecretStore
(`kubernetes/apps/external-secrets/cnpg-ca/`). This is the opt-in path to
`sslmode=verify-full` — actual MITM protection, where `require` /
`rejectUnauthorized:false` only stop passive sniffing.

Proven working (VERIFY-FULL-OK, TLSv1.3; CA re-syncs ~8s after change, Reloader
restarts the app) but **currently unused**: every TLS-capable app ended up on a
non-verifying mechanism, and each app needs a *different* TLS knob — do not try
to generalise one (that caused the outline/postiz crashloop). Candidates for
adoption are the libpq-family apps (grafana, authentik, mealie, *arrs). CNPG's
CA renews in place (current CA expires 2026-07-31); confirm the mirror +
Reloader survive that rotation before promoting this component.

## `volsync`

Restic backup for the app's PVC. Creates ExternalSecret `${APP}-volsync`
(restic repo + password from the `restic` 1Password item) and a
ReplicationSource (daily 03:00 snapshot, 7d/4w/3m retention).

| Variable | Default |
|---|---|
| `VOLSYNC_PVC` | `${APP}` |
| `VOLSYNC_STORAGECLASS` | `csi-rbd-sc` |
| `VOLSYNC_CACHE_CAPACITY` | `1Gi` |

## `ceph-rbd` / `cephfs`

Standalone PVC on Ceph. Variables (`CEPH_RBD_*` / `CEPHFS_*`):
`*_CLAIM_NAME` (default `${APP}`), `*_CAPACITY` (default `1Gi`),
`*_ACCESSMODES` (default `ReadWriteOnce`), `*_STORAGECLASS`
(defaults `csi-rbd-sc` / `csi-cephfs-sc`).

## `gatus/external` and `gatus/guarded`

Drop-in uptime monitoring; each renders a labelled ConfigMap that the gatus
sidecar discovers.

- **external**: HTTPS check of `https://${GATUS_SUBDOMAIN:=${APP}}.${SECRET_DOMAIN}${GATUS_PATH:=/}`
  every 5m, expecting `${GATUS_STATUS:=200}`.
- **guarded**: leak canary — queries public DNS (1.1.1.1) for the app's
  hostname and alerts if it resolves publicly. For internal-only apps.

## `oidc-application`

Creates an Authentik OIDC provider + application via blueprint, a
`bp-${APP}-users` group, and stores client credentials in
`${APP}-oidc-authentik-application`.

Required: `APP`, `SUBDOMAIN`, `GROUP` (Authentik UI category), `DESCRIPTION`,
`REDIRECT_PATH`. Optional: `DISPLAY_NAME` (defaults `${APP}`), `ICON_URL`,
`OIDC_SECRET_NAMESPACE` (defaults `security`; set to the app namespace for
direct secret access).

Consume in the app:

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
```

Access control: users must be in a bound group (`bp-${APP}-users`; `authentik
Admins` is always bound). Group bindings control both authentication and
dashboard visibility. Common callback paths: Outline `/auth/oidc.callback`,
KAN `/api/auth/oauth2/callback/oidc`, Paperless
`/accounts/oidc/authentik/login/callback/`, Grafana `/login/generic_oauth`.

## `proxy-application`

Same blueprint chart as `oidc-application`, but a `forward_single` proxy
provider — for apps with no native OIDC that sit behind Authentik forward auth.
Required: `APP`, `SUBDOMAIN`, `GROUP`, `DESCRIPTION`. Optional: `DISPLAY_NAME`,
`PROXY_ADMIN_GROUP`, `ICON_URL`. Pairs with `ext-auth` below.

## `ext-auth`

Envoy Gateway forward-auth wiring: an HTTPRoute (with the
`/outpost.goauthentik.io` callback routed to the embedded outpost) plus a
SecurityPolicy pointing ext-auth at Authentik.

Required: `APP`, `EXT_AUTH_PORT`. Optional: `EXT_AUTH_HOST` (default `${APP}`),
`EXT_AUTH_SERVICE` (default `${APP}`), `EXT_AUTH_GATEWAY` (default `internal`),
`EXT_AUTH_DNS_TARGET` (set `external.${SECRET_DOMAIN}` for external apps),
`EXT_AUTH_HTTPROUTE_NAME`. The app must NOT define its own route for the same
hostname.

## `s3-bucket`

Declarative Garage bucket on the operator-managed cluster (`garage-operated` in
`database`). Emits a `GarageBucket` + `GarageKey` (operator CRs) in the app's own
namespace; the `GarageKey`'s `secretTemplate` writes `${APP}-s3-credentials`
(`ACCESS_KEY`, `SECRET_KEY`, `BUCKET`, `ENDPOINT`, `REGION`) there. No Job, no CLI
image, no RPC secret — the operator does everything. (This replaced the old
Job/`garage-kubectl`-image version, which never worked.)

Required: `APP`, `NAMESPACE`, `S3_BUCKET`. Prereqs:
- The operator + `garage-operated` cluster must be up (`dependsOn: garage-operated-cluster`).
- A `GarageReferenceGrant` in `database` must permit the app's namespace to reference
  the cluster cross-namespace — see `garage/operator/cluster/referencegrant.yaml`
  (add the namespace there when a new namespace first adopts this component).

The key is MINTED (fresh creds) — for new apps with no prior key. The `ENDPOINT` is
the INTERNAL operated service, so it's for **server-side** S3 (upload/serve from the
app backend). Multiple buckets = instantiate once per bucket with distinct `APP`.

### `s3-bucket/cors` (optional add-on)

Apps whose **browser** uploads directly to S3 (presigned PUT, e.g. Outline) trigger a
CORS preflight the bucket must allow. The `GarageBucket` CRD has no CORS field, so
import `../../../../components/s3-bucket/cors` too: it runs a `PutBucketCors` Job
(stock `aws-cli`, the app's own `owner`-scoped key — no admin token needed) that
self-heals on reconcile.

Extra required: `CORS_SUBDOMAIN` (origin is built as `https://${CORS_SUBDOMAIN}.${SECRET_DOMAIN}`
— pass the SUBDOMAIN, not the full origin, because Flux `postBuild` does NOT expand a
`${SECRET_DOMAIN}` nested inside a `substitute:` value).
Optional overrides for non-component apps that keep creds in their own secret
(e.g. Outline's `outline-secret` with `AWS_*` keys): `CORS_SECRET_NAME`,
`CORS_ACCESS_KEY_KEY`, `CORS_SECRET_KEY_KEY`, `CORS_ENDPOINT`.
Server-side-upload apps (tempo, zipline) and browser-GET-only apps (Kan — presigned
GET is a CORS "simple request", no preflight) do NOT need this.

## `repos/app-template`

OCIRepository for the bjw-s `app-template` chart (single pinned version for the
whole cluster). Included by namespace-level kustomizations; app HelmReleases use
it via `chartRef: {kind: OCIRepository, name: app-template, namespace: flux-system}`.

## `common`

Namespace scaffolding: the namespace object plus SOPS-encrypted
`cluster-secrets` and age key. Used by namespace kustomizations, not by
individual apps.

## Troubleshooting

- **Variable didn't substitute**: `flux get ks <app> -n <ns>` then check
  `postBuild.substitute` — and remember `substituteFrom: cluster-secrets` must
  be present for `${SECRET_DOMAIN}`-style variables.
- **Component resource landed in the wrong namespace**: the ks
  `targetNamespace` overrides everything; components cannot place resources in
  another namespace.
- **HelmRelease ignores component values**: check `spec.valuesFrom` references
  `${APP}-cnpg-values` / `${APP}-dragonfly-values` and that the controller key
  (`DB_CONTROLLER`) matches the app's actual controller name.
- **OIDC secret missing**: `kubectl get hr -n <ns> <app>-oidc` and check the
  Authentik blueprint applied; verify user is in `bp-<app>-users` or `authentik
  Admins`.
