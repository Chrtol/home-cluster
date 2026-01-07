#!/bin/bash
# Script to create Pangolin Traefik bouncer for Crowdsec

echo "=== Creating Pangolin Traefik Bouncer ==="
echo ""

# Check if the bouncer already exists
if sudo cscli bouncers list | grep -q "pangolin-traefik"; then
    echo "⚠️  Bouncer 'pangolin-traefik' already exists!"
    echo ""
    echo "To recreate it, first delete the existing one:"
    echo "  sudo cscli bouncers delete pangolin-traefik"
    echo ""
    exit 1
fi

# Create the new bouncer
echo "Creating new bouncer 'pangolin-traefik'..."
OUTPUT=$(sudo cscli bouncers add pangolin-traefik 2>&1)

# Extract the API key
API_KEY=$(echo "$OUTPUT" | grep -oP "Api key for 'pangolin-traefik': \K[a-f0-9-]+")

if [ -z "$API_KEY" ]; then
    echo "❌ Failed to create bouncer or extract API key"
    echo "Output was: $OUTPUT"
    exit 1
fi

echo "✅ Successfully created bouncer!"
echo ""
echo "=========================================="
echo "API Key for 'pangolin-traefik':"
echo "$API_KEY"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Copy the API key above"
echo "2. Add it to 1Password:"
echo "   - Item: crowdsec (in Homelab vault)"
echo "   - Field name: CROWDSEC_PANGOLIN_BOUNCER_KEY"
echo "   - Value: $API_KEY"
echo ""
echo "3. Verify with: sudo cscli bouncers list"