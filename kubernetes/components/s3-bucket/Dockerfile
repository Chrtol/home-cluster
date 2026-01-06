# Multi-tool image for Garage S3 bucket management
FROM alpine:3.19

# Install required tools
RUN apk add --no-cache \
    bash \
    curl \
    aws-cli \
    jq \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Download and install Garage CLI
RUN wget https://github.com/deuxfleurs-org/garage/releases/download/v1.3.0/garage-v1.3.0-x86_64-linux.tar.gz \
    && tar -xzf garage-v1.3.0-x86_64-linux.tar.gz \
    && mv garage /usr/local/bin/ \
    && rm garage-v1.3.0-x86_64-linux.tar.gz

# Verify installations
RUN garage --version && kubectl version --client && aws --version

ENTRYPOINT ["/bin/bash"]