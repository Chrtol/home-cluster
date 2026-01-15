# nginx-otel Role

This role deploys nginx with native OpenTelemetry instrumentation as a Docker container, replacing the system nginx installation.

## Features

- Uses official `nginx:alpine-otel` Docker image with pre-built OpenTelemetry module
- Sends distributed traces directly to Tempo via OTLP
- Fully idempotent and declarative configuration
- Automatically disables system nginx when deployed
- Rich telemetry data including request timing, upstream connections, and more

## Usage

The role is controlled via the `use_nginx_otel` feature flag in `nginx-only.yml`:

```yaml
use_nginx_otel: "{{ lookup('env', 'NGINX_USE_OTEL') | default('true') | bool }}"
```

When `use_nginx_otel` is true:
- System nginx is stopped and disabled
- Containerized nginx-otel is deployed and managed
- OpenTelemetry traces are sent to Tempo

When `use_nginx_otel` is false:
- Traditional system nginx is used
- No OpenTelemetry instrumentation

## Configuration

The role uses the same nginx configuration templates as the system nginx role, with additional OpenTelemetry directives:

- `nginx.conf.j2` - Main nginx configuration with OpenTelemetry module loading
- `default.conf.j2` - Site configuration with span attributes and trace propagation
- `docker-compose.yml.j2` - Container orchestration configuration

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `nginx_otel_image` | `nginx:alpine-otel` | Docker image to use |
| `nginx_otel_dir` | `/opt/nginx-otel` | Base directory for configuration |
| `otel_exporter_endpoint` | `{{ nginx_external_ingress_ip }}:4317` | Tempo OTLP endpoint |
| `otel_service_name` | `vps-nginx` | Service name in traces |
| `otel_service_namespace` | `vps` | Service namespace |

## Idempotency

The role is fully idempotent and can be run repeatedly:
- Checks if system nginx is installed before attempting to stop it
- Only restarts the container if configuration has changed
- Properly manages SSL certificate copying
- Ensures desired state regardless of current state

## Monitoring

View traces in Grafana:
1. Navigate to Explore → Tempo
2. Search for service: `vps-nginx`
3. View service graph to see all traced requests

Container logs:
```bash
docker logs nginx-otel
docker-compose -f /opt/nginx-otel/docker-compose.yml logs -f
```

## Rollback

To revert to system nginx:
1. Set `NGINX_USE_OTEL=false` environment variable
2. Run the playbook: `ansible-playbook nginx-only.yml -i inventory.yml`