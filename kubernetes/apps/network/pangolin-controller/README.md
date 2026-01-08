# Pangolin Blueprint Controller

## Overview

The Pangolin Blueprint Controller is a Kubernetes controller that automatically creates and manages Pangolin authentication blueprints based on labeled Kubernetes resources (HTTPRoutes, Ingresses, etc.). It works similar to external-dns or cert-manager, continuously watching for resources and syncing them to Pangolin.

## Features

- **Automatic Blueprint Creation**: Watches for HTTPRoutes and Ingresses with specific labels and creates corresponding Pangolin blueprints
- **Multi-Resource Support**: Supports both Gateway API (HTTPRoutes) and Ingress resources
- **Flexible Configuration**: Use labels and annotations to control blueprint behavior
- **Continuous Sync**: Maintains sync between Kubernetes resources and Pangolin blueprints

## How It Works

1. The controller watches for HTTPRoutes and Ingresses across all namespaces
2. When it finds a resource with the `pangolin.io/managed: "true"` label, it extracts configuration
3. It creates or updates a corresponding blueprint in Pangolin
4. When the resource is deleted, the blueprint is also removed

## Configuration

### Labels

| Label | Description | Required | Default |
|-------|-------------|----------|---------|
| `pangolin.io/managed` | Set to "true" to manage this resource | Yes | - |
| `pangolin.io/blueprint` | Custom blueprint name | No | `{namespace}-{name}` |

### Annotations

| Annotation | Description | Default |
|------------|-------------|---------|
| `pangolin.io/organization` | Pangolin organization | `homelab` |
| `pangolin.io/site` | Pangolin site name | `newt-home-cluster` |
| `pangolin.io/auth-type` | Authentication type (oauth2, basic, jwt) | `oauth2` |
| `pangolin.io/public` | Allow public access without auth | `false` |
| `pangolin.io/require-mfa` | Require MFA for access | `false` |
| `pangolin.io/allowed-groups` | Comma-separated list of allowed groups | - |

## Examples

### Basic HTTPRoute with OAuth2 Protection

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: my-app
  namespace: default
  labels:
    pangolin.io/managed: "true"
  annotations:
    pangolin.io/auth-type: "oauth2"
spec:
  hostnames:
  - "app.example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: my-app-service
      port: 80
```

### Public Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: public-site
  labels:
    pangolin.io/managed: "true"
  annotations:
    pangolin.io/public: "true"
spec:
  rules:
  - host: public.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: public-service
            port:
              number: 80
```

### Protected Admin Interface

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: admin-panel
  labels:
    pangolin.io/managed: "true"
    pangolin.io/blueprint: "admin-access"
  annotations:
    pangolin.io/auth-type: "oauth2"
    pangolin.io/require-mfa: "true"
    pangolin.io/allowed-groups: "admin,operators"
spec:
  hostnames:
  - "admin.example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: admin-service
      port: 443
```

## Deployment

1. Ensure the Pangolin API secret exists:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: pangolin-api
  namespace: network
stringData:
  endpoint: "https://api.pangolin.example.com:8443"
  apiKey: "your-api-key-here"
```

2. Deploy the controller:
```bash
kubectl apply -k kubernetes/apps/network/pangolin-controller/app/
```

3. Verify the controller is running:
```bash
kubectl -n network logs -f deployment/pangolin-controller
```

## Architecture

The controller consists of:

- **Controller Script**: Python-based controller that watches Kubernetes resources
- **Deployment**: Runs the controller with appropriate environment variables
- **ServiceAccount & RBAC**: Permissions to watch HTTPRoutes, Ingresses, and Services
- **ConfigMap**: Contains the controller script

## Future Enhancements

- [ ] Support for Services with specific annotations
- [ ] Webhook support for instant updates
- [ ] Metrics and monitoring
- [ ] Support for custom resource definitions
- [ ] Blueprint template system
- [ ] Multi-cluster support
- [ ] Backup and restore of blueprints
- [ ] Dry-run mode for testing

## Troubleshooting

### Controller not processing resources

1. Check if the resource has the required label:
```bash
kubectl get httproute,ingress -A -l pangolin.io/managed=true
```

2. Check controller logs:
```bash
kubectl -n network logs deployment/pangolin-controller
```

3. Verify RBAC permissions:
```bash
kubectl auth can-i list httproutes --as=system:serviceaccount:network:pangolin-controller
```

### Blueprints not appearing in Pangolin

1. Verify API connectivity from the controller pod
2. Check API key permissions in Pangolin
3. Ensure organization and site exist in Pangolin

## Similar Projects

This controller is inspired by:
- [external-dns](https://github.com/kubernetes-sigs/external-dns) - Creates DNS records for Kubernetes resources
- [cert-manager](https://cert-manager.io/) - Manages TLS certificates for Kubernetes
- [Authentik](https://goauthentik.io/) - Identity provider with Kubernetes integration