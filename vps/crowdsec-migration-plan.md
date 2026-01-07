# Migrating Crowdsec from Host to Docker Container

## Current State → Future State
- **Now**: Crowdsec on host (systemd service, port 8080)
- **Future**: Crowdsec in Docker container (managed with Pangolin)

## Migration Timeline

### Phase 1: Deploy Pangolin with Host Crowdsec (NOW)
Deploy Pangolin using existing host Crowdsec:
```bash
# Uses docker-compose-staging-no-crowdsec.yml
# Connects to host Crowdsec on 172.17.0.1:8080
```

### Phase 2: Prepare Containerized Crowdsec (Testing)
1. **Export current configuration**:
   ```bash
   # Backup current Crowdsec data
   sudo tar -czf crowdsec-backup.tar.gz \
     /etc/crowdsec \
     /var/lib/crowdsec

   # Export decisions/bans
   sudo cscli decisions list -o json > decisions-backup.json

   # List current bouncers
   sudo cscli bouncers list
   ```

2. **Prepare Docker Crowdsec config**:
   ```bash
   # Create config directories
   mkdir -p /opt/pangolin/config/crowdsec/{data,config,acquis.d}

   # Copy configuration
   sudo cp -r /etc/crowdsec/* /opt/pangolin/config/crowdsec/config/
   sudo cp -r /var/lib/crowdsec/* /opt/pangolin/config/crowdsec/data/
   ```

3. **Start containerized Crowdsec on different port (8082)**:
   ```bash
   # This runs alongside existing Crowdsec for testing
   cd /opt/pangolin
   # Switch to docker-compose-staging-with-crowdsec.yml
   ```

### Phase 3: Migration (< 1 minute downtime)

**Migration Script:**
```bash
#!/bin/bash
# crowdsec-migrate.sh

echo "Starting Crowdsec migration to Docker..."

# 1. Export all bouncers and their keys
sudo cscli bouncers list -o json > /tmp/bouncers.json

# 2. Stop host Crowdsec
sudo systemctl stop crowdsec
sudo systemctl stop crowdsec-firewall-bouncer

# 3. Switch Pangolin to use containerized Crowdsec
cd /opt/pangolin
cp docker-compose-staging-with-crowdsec.yml docker-compose.yml

# 4. Update port from 8082 to 8080 in docker-compose
sed -i 's/127.0.0.1:8082/127.0.0.1:8080/g' docker-compose.yml

# 5. Restart Pangolin with integrated Crowdsec
docker compose down
docker compose up -d

# 6. Re-add bouncers to containerized Crowdsec
docker exec crowdsec cscli bouncers add firewall-bouncer

# 7. Update firewall bouncer config
echo "Update /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml"
echo "with new API key from step 6"

# 8. Restart firewall bouncer
sudo systemctl start crowdsec-firewall-bouncer

echo "Migration complete!"
```

### Phase 4: Cleanup
```bash
# Disable host Crowdsec
sudo systemctl disable crowdsec

# Remove host Crowdsec (optional)
sudo apt remove crowdsec

# Or keep it installed but disabled as backup
```

## Benefits of Containerized Crowdsec

✅ **Unified management** - Everything in Docker Compose
✅ **Easy updates** - Just update image tag
✅ **Better isolation** - Container boundaries
✅ **Portable** - Easy to move to new VPS
✅ **Consistent logs** - All logs in /opt/pangolin/config/logs

## Configuration Sync

The containerized Crowdsec will:
1. Read Pangolin/Traefik logs from shared volume
2. Continue using firewall bouncer on host for SSH protection
3. Maintain all your existing ban decisions
4. Keep your custom parsers and scenarios

## Rollback Plan

If issues occur:
```bash
# Stop container
docker compose down

# Restart host Crowdsec
sudo systemctl start crowdsec
sudo systemctl start crowdsec-firewall-bouncer

# Switch Pangolin back to host Crowdsec
cp docker-compose-staging-no-crowdsec.yml docker-compose.yml
docker compose up -d
```

## Testing Checklist

Before migration:
- [ ] Backup all Crowdsec configs
- [ ] Test containerized Crowdsec on port 8082
- [ ] Verify bouncers can connect
- [ ] Ensure decisions are preserved
- [ ] Check firewall rules still work

After migration:
- [ ] Verify Traefik bouncer works
- [ ] Confirm firewall bouncer protects SSH
- [ ] Check metrics and logs
- [ ] Test ban/unban functionality
- [ ] Monitor for 24 hours