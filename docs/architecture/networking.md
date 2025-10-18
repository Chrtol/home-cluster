# Networking Architecture

## Network Overview

The cluster networking is built on a modern, highly available foundation using Cilium CNI with BGP load balancing. The design emphasizes performance, security, and reliability while maintaining simplicity for home environment management.

## Network Topology

### Physical Network
- **Network**: 10.0.30.0/24
- **Gateway**: 10.0.30.1 (Router/Firewall)
- **DNS**: 10.0.30.1 (Primary), 9.9.9.9 (Secondary - Quad9)
- **DHCP**: Managed by router for general network
- **Static IPs**: Kubernetes nodes and services use static assignments

### IP Address Allocation

#### Infrastructure Services
| Service | IP Address | Purpose |
|---------|------------|---------|
| Router/Gateway | 10.0.30.1 | Network gateway and BGP peer |
| Kubernetes API | 10.0.30.50 | kube-apiserver VIP |
| Internal Ingress | 10.0.30.40 | Internal service access |
| External Ingress | 10.0.30.60 | External service access |
| DNS Gateway | 10.0.30.45 | k8s_gateway for internal DNS |

#### Kubernetes Nodes
| Node | IP Address | Role | Hardware |
|------|------------|------|----------|
| lenovo1 | 10.0.30.100 | Controller + Worker | Lenovo ThinkCentre M910q |
| lenovo2 | 10.0.30.101 | Controller + Worker | Lenovo ThinkCentre M910q |
| dell1 | 10.0.30.102 | Controller + Worker | Dell OptiPlex 3080 |

#### External Infrastructure
| Service | IP Address | Purpose |
|---------|------------|---------|
| TrueNAS | 10.0.30.10 | NFS storage server |

## Kubernetes Networking

### Pod and Service Networks
- **Pod CIDR**: 10.42.0.0/16 (default)
- **Service CIDR**: 10.43.0.0/16 (default)
- **ClusterIP Range**: Automatically allocated from service CIDR
- **LoadBalancer Range**: Managed by Cilium BGP

### CNI Configuration
- **CNI**: Cilium with eBPF dataplane
- **IPAM**: Kubernetes host-scope IPAM
- **Load Balancer**: BGP-based with DSR (Direct Server Return)
- **Security**: Network policies and pod security

## BGP Configuration

### BGP Peering
- **Router ASN**: 64513
- **Cluster ASN**: 64514
- **Peer Address**: 10.0.30.1 (Router)
- **Advertisement**: LoadBalancer service IPs

### BGP Capabilities
- **High Availability**: Multiple nodes can advertise same VIP
- **Load Balancing**: Traffic distributed across healthy nodes
- **Fast Failover**: BGP convergence for rapid failover
- **Equal Cost Multi-Path**: Traffic balancing across paths

## Service Discovery

### Internal DNS
- **CoreDNS**: Kubernetes cluster DNS
- **k8s_gateway**: External DNS for Kubernetes services
- **Split DNS**: Internal domain resolution for cluster services
- **Upstream**: Cloudflare DNS for external resolution

### DNS Configuration
```yaml
# CoreDNS configuration for cluster services
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
            ttl 30
        }
        prometheus :9153
        forward . 1.1.1.1 1.0.0.1
        cache 30
        loop
        reload
        loadbalance
    }
    example.com:53 {
        errors
        cache 30
        forward . 10.0.30.1
    }
```

## Ingress Architecture

### Dual Ingress Setup
The cluster uses two ingress controllers for different traffic types:

#### Internal Ingress (10.0.30.40)
- **Purpose**: Internal network access to services
- **TLS**: Internal certificates or HTTP
- **Access**: Only from internal network
- **Class**: `internal`

#### External Ingress (10.0.30.60)
- **Purpose**: External access via Cloudflare tunnel
- **TLS**: Let's Encrypt certificates
- **Access**: Internet-facing services
- **Class**: `external`

### Ingress Configuration
```yaml
# Example service with dual ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-service
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "https://auth.example.com/oauth2/auth"
spec:
  ingressClassName: external
  tls:
    - hosts:
        - example.example.com
      secretName: example-com-tls
  rules:
    - host: example.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: example-service
                port:
                  number: 80
```

## External Connectivity

### Cloudflare Integration
- **Domain**: example.com
- **DNS**: Cloudflare DNS with external-dns automation
- **Tunnel**: Cloudflared for secure external access
- **Certificates**: Let's Encrypt via cert-manager

### Cloudflare Tunnel Configuration
```yaml
# Cloudflare tunnel configuration
tunnel: kubernetes
credentials-file: /etc/cloudflared/creds/credentials.json
ingress:
  - hostname: "*.example.com"
    service: https://10.0.30.60:443
    originRequest:
      originServerName: "*.example.com"
      noTLSVerify: true
  - service: http_status:404
```

## Security

### Network Policies
- **Default Deny**: All namespaces have default deny policies
- **Explicit Allow**: Only required traffic is permitted
- **Ingress/Egress**: Controlled access between pods and external services
- **Namespace Isolation**: Logical separation of workloads

### TLS/SSL Configuration
- **Internal**: Self-signed or internal CA certificates
- **External**: Let's Encrypt certificates via cert-manager
- **Encryption**: All external traffic encrypted
- **Certificate Management**: Automated certificate lifecycle

## Monitoring & Observability

### Network Monitoring
- **Cilium Metrics**: Network performance and security metrics
- **BGP Status**: Routing table and peer status monitoring
- **Service Monitoring**: Ingress and service health checks
- **DNS Monitoring**: Query resolution and performance

### Key Metrics
- **Latency**: Pod-to-pod and service response times
- **Throughput**: Network bandwidth utilization
- **Packet Loss**: Network reliability metrics
- **Connection Tracking**: Active connections and states

## Troubleshooting

### Common Network Issues

#### Pod Communication
```bash
# Check pod network connectivity
kubectl exec -it pod-name -- ping target-pod-ip

# Verify DNS resolution
kubectl exec -it pod-name -- nslookup service-name.namespace.svc.cluster.local

# Check network policies
kubectl get networkpolicies -A
```

#### Service Discovery
```bash
# Check service endpoints
kubectl get endpoints service-name -n namespace

# Verify ingress configuration
kubectl get ingress -A
kubectl describe ingress ingress-name -n namespace

# Test DNS resolution
dig @10.0.30.45 service.example.com
```

#### BGP Troubleshooting
```bash
# Check Cilium BGP status
kubectl exec -n kube-system cilium-xxx -- cilium bgp peers
kubectl exec -n kube-system cilium-xxx -- cilium bgp routes

# Verify LoadBalancer services
kubectl get svc -A --field-selector spec.type=LoadBalancer
```

### Network Diagnostics
- **Cilium CLI**: `cilium status`, `cilium connectivity test`
- **Network Debugging**: Pod network namespace inspection
- **Traffic Analysis**: Wireshark/tcpdump for packet analysis
- **BGP Monitoring**: Router BGP table verification

## Performance Optimization

### Network Tuning
- **MTU**: 1500 bytes (standard Ethernet)
- **Buffer Sizes**: Optimized for cluster workloads
- **Connection Limits**: Tuned for high-concurrency applications
- **Kernel Parameters**: Network stack optimization

### Load Balancing
- **Algorithm**: Round-robin with health checks
- **Session Affinity**: Configured per service requirement
- **Health Checks**: Proactive monitoring and failover
- **Scaling**: Horizontal scaling based on network metrics

---

**Last Updated**: 2025-07-16  
**Network Version**: v2.0 (BGP-enabled)  
**Next Review**: 2025-10-16
