# Custom nginx with proper OpenTelemetry support
FROM nginx:1.27-alpine

# Install dependencies
RUN apk add --no-cache wget tar

# Download and install the OpenTelemetry module from opentelemetry-cpp-contrib
# This version has the opentelemetry_context_traceparent variable we need
RUN cd /tmp && \
    wget https://github.com/open-telemetry/opentelemetry-cpp-contrib/releases/download/nginx-1.27.3/opentelemetry-nginx-1.27.3-alpine-3.21-x86_64.tar.gz && \
    tar -xzf opentelemetry-nginx-1.27.3-alpine-3.21-x86_64.tar.gz && \
    cp otel_ngx_module.so /usr/lib/nginx/modules/ && \
    rm -rf /tmp/*

# Create module configuration
RUN echo "load_module modules/otel_ngx_module.so;" > /etc/nginx/modules/otel.conf

# The module provides these variables:
# - $opentelemetry_context_traceparent (full W3C header)
# - $opentelemetry_trace_id
# - $opentelemetry_span_id
# These allow proper parent-child span relationships

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]