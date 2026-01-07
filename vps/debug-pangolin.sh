#!/bin/bash
# Debug Pangolin deployment issues

echo "=========================================="
echo "PANGOLIN DEBUGGING"
echo "=========================================="

echo -e "\n1. Check container status:"
sudo docker ps -a --filter "label=com.docker.compose.project=pangolin" --format "table {{.Names}}\t{{.Status}}\t{{.State}}"

echo -e "\n2. Check Pangolin logs (last 30 lines):"
sudo docker logs pangolin --tail 30 2>&1

echo -e "\n3. Check if Pangolin is listening on port 3001:"
sudo docker exec pangolin netstat -tulpn 2>/dev/null | grep 3001 || echo "Port 3001 not listening"

echo -e "\n4. Test internal connectivity from Traefik to Pangolin:"
sudo docker exec traefik wget -q -O- --timeout=2 http://pangolin:3001/health 2>&1 || echo "Cannot reach Pangolin from Traefik"

echo -e "\n5. Check Docker network:"
sudo docker network inspect pangolin_default 2>/dev/null | jq -r '.[] | .Containers | to_entries[] | "\(.value.Name): \(.value.IPv4Address)"' || docker network ls | grep pangolin

echo -e "\n6. Check Gerbil status:"
sudo docker logs gerbil --tail 20 2>&1

echo -e "\n7. Check for port conflicts:"
sudo netstat -tulpn | grep -E ":(3001|3004|8081|8443|51821|21821)" | grep -v docker

echo -e "\n8. Docker compose status:"
cd /opt/pangolin && docker compose ps

echo -e "\n9. Check Pangolin environment variables:"
sudo docker exec pangolin env | grep -E "(NODE_ENV|PORT|GERBIL)" | sort

echo -e "\n10. Test Pangolin API directly:"
sudo docker exec pangolin curl -s http://localhost:3001/api/v1/health || echo "Pangolin API not responding"