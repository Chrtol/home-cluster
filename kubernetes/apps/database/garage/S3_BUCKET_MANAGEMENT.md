# Garage S3 Bucket Management Guide

This guide explains how to create and manage S3 buckets in Garage for your applications.

## Prerequisites

- Access to the Kubernetes cluster
- `kubectl` configured with the correct kubeconfig
- Garage deployment running in the `database` namespace

## 1. Creating a New S3 Bucket

### Step 1: Create the Bucket

```bash
export KUBECONFIG=/home/chrto/Homelab/github/chrtol/home-cluster/kubeconfig
kubectl exec -n database deployment/garage -- /garage bucket create <bucket-name>
```

Example:
```bash
kubectl exec -n database deployment/garage -- /garage bucket create outline
```

### Step 2: Create an Access Key

```bash
kubectl exec -n database deployment/garage -- /garage key create <key-name>
```

Example:
```bash
kubectl exec -n database deployment/garage -- /garage key create outline-key
```

### Step 3: Grant Permissions

Grant the key access to the bucket:
```bash
kubectl exec -n database deployment/garage -- /garage bucket allow <bucket-name> --read --write --owner --key <key-name>
```

Example:
```bash
kubectl exec -n database deployment/garage -- /garage bucket allow outline --read --write --owner --key outline-key
```

### Step 4: Get the Credentials

View the key details to get the access credentials:
```bash
kubectl exec -n database deployment/garage -- /garage key info <key-name>
```

Example output:
```
Key ID: GK7asdfasdfas234234
Secret key: 9111a0edc620acb21864d35005949fe1c7e856d6bc43a0291c5d3bb04cfb1c1c
```

## 2. Storing Credentials in 1Password

Create a new item in 1Password with the following fields:

### Required Fields for S3 Applications

| Field Name | Value | Description |
|------------|-------|-------------|
| `<APP>_S3_ACCESS_KEY_ID` | `GK...` | The Key ID from Step 4 |
| `<APP>_S3_SECRET_ACCESS_KEY` | `<long-string>` | The Secret key from Step 4 |

Example for Outline:
- `OUTLINE_S3_ACCESS_KEY_ID`: `GK7asdfasdfas234234`
- `OUTLINE_S3_SECRET_ACCESS_KEY`: `9111a0edc620acb21864d35005949fe1c7e856d6bc43a0291c5d3bb04cfb1c1c`

## 3. Application Configuration

### Environment Variables

Applications need these environment variables configured:

```yaml
AWS_ACCESS_KEY_ID: "{{ .<APP>_S3_ACCESS_KEY_ID }}"
AWS_SECRET_ACCESS_KEY: "{{ .<APP>_S3_SECRET_ACCESS_KEY }}"
AWS_REGION: "homelab"
AWS_S3_UPLOAD_BUCKET_NAME: "<bucket-name>"
AWS_S3_UPLOAD_BUCKET_URL: "https://s3.${SECRET_DOMAIN}"  # For external apps
# OR
AWS_S3_UPLOAD_BUCKET_URL: "http://garage.database.svc.cluster.local:3900"  # For internal apps
AWS_S3_FORCE_PATH_STYLE: "true"
AWS_S3_ACL: "private"
```

### Access URLs

- **Internal (within cluster)**: `http://garage.database.svc.cluster.local:3900`
- **External (browser/public)**: `https://s3.${SECRET_DOMAIN}`

## 4. CORS Configuration

Garage requires CORS to be configured per-bucket using the S3 API (not in the config file).

### Apply CORS Rules

1. Create a CORS configuration file:

```bash
cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://app.example.com"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Range"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF
```

2. Apply CORS to the bucket:

```bash
kubectl run aws-cli --rm -i --restart=Never --image=amazon/aws-cli:latest \
  --env="AWS_ACCESS_KEY_ID=<key-id>" \
  --env="AWS_SECRET_ACCESS_KEY=<secret-key>" \
  --env="AWS_REGION=homelab" \
  -- s3api put-bucket-cors \
  --bucket <bucket-name> \
  --cors-configuration file:///dev/stdin \
  --endpoint-url http://garage.database.svc.cluster.local:3900 < /tmp/cors.json
```

### View Current CORS Rules

```bash
kubectl run aws-cli --rm -i --restart=Never --image=amazon/aws-cli:latest \
  --env="AWS_ACCESS_KEY_ID=<key-id>" \
  --env="AWS_SECRET_ACCESS_KEY=<secret-key>" \
  --env="AWS_REGION=homelab" \
  -- s3api get-bucket-cors \
  --bucket <bucket-name> \
  --endpoint-url http://garage.database.svc.cluster.local:3900
```

### Update CORS Rules (Add More Origins)

To add more allowed origins, update the CORS configuration:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "https://docs.example.com",
        "https://wiki.example.com",
        "https://notes.example.com"
      ],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Range"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

Then reapply using the same `put-bucket-cors` command.

## 5. Common Operations

### List All Buckets

```bash
kubectl exec -n database deployment/garage -- /garage bucket list
```

### Get Bucket Info

```bash
kubectl exec -n database deployment/garage -- /garage bucket info <bucket-name>
```

### List All Keys

```bash
kubectl exec -n database deployment/garage -- /garage key list
```

### Delete a Bucket (Careful!)

```bash
kubectl exec -n database deployment/garage -- /garage bucket delete <bucket-name>
```

### Revoke Key Access

```bash
kubectl exec -n database deployment/garage -- /garage bucket deny <bucket-name> --key <key-name>
```

## 6. Troubleshooting

### CORS Errors

If you see CORS errors in the browser console:
1. Check that the origin is in the CORS allowed origins list
2. Ensure CORS is applied to the bucket (not just in Garage config)
3. Verify the app is using the correct S3 endpoint URL

### Connection Issues

- **Internal apps**: Use `http://garage.database.svc.cluster.local:3900`
- **External/browser**: Use `https://s3.${SECRET_DOMAIN}`
- Check that Garage ingress has `className: external` for public access

### Mixed Content Errors

If browser blocks "mixed content":
- Ensure the app uses HTTPS URL for S3 (`https://s3.${SECRET_DOMAIN}`)
- Not the internal HTTP endpoint

## 7. Example: Complete Setup for New App

Here's a complete example for setting up S3 for a new app called "myapp":

```bash
# 1. Create bucket and key
kubectl exec -n database deployment/garage -- /garage bucket create myapp
kubectl exec -n database deployment/garage -- /garage key create myapp-key
kubectl exec -n database deployment/garage -- /garage bucket allow myapp --read --write --owner --key myapp-key

# 2. Get credentials
kubectl exec -n database deployment/garage -- /garage key info myapp-key
# Save the Key ID and Secret key to 1Password as:
# MYAPP_S3_ACCESS_KEY_ID
# MYAPP_S3_SECRET_ACCESS_KEY

# 3. Apply CORS (if needed for browser uploads)
cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [{
    "AllowedOrigins": ["https://myapp.example.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range"],
    "MaxAgeSeconds": 3600
  }]
}
EOF

kubectl run aws-cli --rm -i --restart=Never --image=amazon/aws-cli:latest \
  --env="AWS_ACCESS_KEY_ID=GK..." \
  --env="AWS_SECRET_ACCESS_KEY=..." \
  --env="AWS_REGION=homelab" \
  -- s3api put-bucket-cors \
  --bucket myapp \
  --cors-configuration file:///dev/stdin \
  --endpoint-url http://garage.database.svc.cluster.local:3900 < /tmp/cors.json
```

## Notes

- Garage stores data on NAS at `/mnt/truenas/cf-nas/s3/data`
- Metadata is stored at `/mnt/truenas/cf-nas/s3/meta`
- The `postgres-wal` bucket is used for database backups - do not modify
- Always use `AWS_S3_FORCE_PATH_STYLE: "true"` with Garage