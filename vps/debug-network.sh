#!/bin/bash
# Debug network connectivity between Pangolin containers

echo "=========================================="
echo "NETWORK DEBUGGING FOR PANGOLIN"
echo "=========================================="

echo -e "\n1. Docker networks:"
sudo docker network ls | grep -E "(pangolin|bridge)"

echo -e "\n2. Inspect pangolin network:"
sudo docker network inspect pangolin_network 2>/dev/null || sudo docker network inspect pangolin 2>/dev/null || echo "No pangolin network found"

echo -e "\n3. Container network assignments:"
for container in pangolin gerbil traefik; do
    echo -e "\n$container:"
    sudo docker inspect $container 2>/dev/null | jq -r '.[0].NetworkSettings.Networks | to_entries[] | "\(.key): \(.value.IPAddress)"' || echo "  Not found"
done

echo -e "\n4. Test connectivity from Gerbil to Pangolin:"
sudo docker exec gerbil ping -c 2 pangolin 2>&1 || echo "Cannot ping from gerbil"
sudo docker exec gerbil wget -q -O- --timeout=2 http://pangolin:3001/api/v1/ 2>&1 || echo "Cannot reach API from gerbil"

echo -e "\n5. Test DNS resolution:"
sudo docker exec gerbil nslookup pangolin 2>&1 || sudo docker exec gerbil getent hosts pangolin 2>&1 || echo "DNS not working"

echo -e "\n6. Check if Pangolin is listening:"
sudo docker exec pangolin ss -tlnp 2>/dev/null | grep 3001 || sudo docker exec pangolin netstat -tlnp 2>/dev/null | grep 3001 || echo "Not listening on 3001"

echo -e "\n7. Test from inside Traefik's network namespace:"
# Since Traefik uses network_mode: service:gerbil, it sees what gerbil sees
sudo docker exec traefik wget -q -O- --timeout=2 http://localhost:3001/api/v1/ 2>&1 || echo "Cannot reach via localhost"
sudo docker exec traefik wget -q -O- --timeout=2 http://172.19.0.2:3001/api/v1/ 2>&1 || echo "Cannot reach via IP"

echo -e "\n8. Check iptables inside Gerbil (may affect routing):"
sudo docker exec gerbil iptables -L -n 2>/dev/null | head -20 || echo "Cannot check iptables"

echo -e "\n9. Docker compose project status:"
cd /opt/pangolin && sudo docker compose ps --format json | jq -r '.[] | "\(.Name): \(.State) - Networks: \(.Networks)"' 2>/dev/null || sudo docker compose ps

echo -e "\n10. Check for network conflicts:"
sudo docker network ls --format "table {{.Name}}\t{{.Driver}}\t{{.ID}}"