# Integrating Pangolin with Existing Crowdsec

Since you already have Crowdsec running on your VPS, we'll configure Pangolin to use it rather than deploying a duplicate.

## Prerequisites

### 1. Generate Bouncer API Key for Traefik

On your VPS, run:

```bash
# Generate a new bouncer key for Pangolin's Traefik
sudo cscli bouncers add pangolin-traefik

# Save the generated API key - you'll need it for deployment
```

### 2. Verify Crowdsec is Accessible

```bash
# Check Crowdsec is listening on localhost:8080
sudo ss -tlnp | grep 8080

# Verify API is responding
curl http://127.0.0.1:8080/v1/info
```

### 3. Configure DNS

Add a wildcard DNS record for Pangolin:
- Type: A
- Name: `*.pangolin`
- Value: Your VPS IP
- Result: `*.pangolin.yourdomain.com` → VPS IP

This allows Pangolin to create subdomains for resources dynamically.

## How It Works

```
Internet → Pangolin Traefik (8443) → Checks with Host Crowdsec (8080) → Allow/Block
```

1. **Pangolin's Traefik** receives requests on ports 8081/8443
2. **Crowdsec Plugin** in Traefik queries your existing Crowdsec instance
3. **Decision**: Allow legitimate traffic or block/captcha suspicious IPs
4. Your existing **firewall bouncer** continues protecting SSH and other services

## Configuration in docker-compose

The staging docker-compose is configured to:
- NOT include a Crowdsec container
- Connect Traefik to host Crowdsec via `172.17.0.1:8080`
- Use the bouncer API key you generate

## Add to 1Password

Create a new field in your `pangolin-config` item:
- **crowdsec_bouncer_key**: [The API key from step 1]

Or set as environment variable during deployment:
```bash
export CROWDSEC_BOUNCER_KEY="your-generated-key"
```

## Benefits

✅ No duplicate Crowdsec instances
✅ Unified security decisions across all services
✅ Your existing bans/decisions apply to Pangolin
✅ Single Crowdsec dashboard for monitoring

## Testing After Deployment

```bash
# View Crowdsec metrics
sudo cscli metrics

# Check if Pangolin bouncer is connected
sudo cscli bouncers list

# Test ban (careful - bans your IP for 1 minute)
sudo cscli decisions add -i YOUR_IP -t ban -d 1m
```

## Troubleshooting

If Traefik can't connect to Crowdsec:

1. Check Docker can reach host:
   ```bash
   docker run --rm alpine ping -c 4 host.docker.internal
   ```

2. Verify Crowdsec allows Docker network:
   ```bash
   # Check if 172.17.0.0/16 is allowed in Crowdsec config
   sudo grep -r "172.17" /etc/crowdsec/
   ```

3. Check bouncer key is valid:
   ```bash
   sudo cscli bouncers list
   ```