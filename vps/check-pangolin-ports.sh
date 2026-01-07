#!/bin/bash
echo "Checking what ports Pangolin is listening on:"
sudo docker exec pangolin ss -tlnp | grep LISTEN || sudo docker exec pangolin netstat -tlnp | grep LISTEN

echo -e "\nChecking Pangolin environment:"
sudo docker exec pangolin env | grep -E "PORT|SERVER" | sort

echo -e "\nTesting API endpoints:"
echo "Port 3000 (external):"
sudo docker exec pangolin curl -s http://localhost:3000/api/v1/ || echo "Not responding on 3000"
echo -e "\nPort 3001 (internal):"
sudo docker exec pangolin curl -s http://localhost:3001/api/v1/ || echo "Not responding on 3001"

echo -e "\nFrom Gerbil's perspective:"
sudo docker exec gerbil wget -q -O- --timeout=2 http://pangolin:3000/api/v1/ 2>&1 || echo "Cannot reach on 3000"
sudo docker exec gerbil wget -q -O- --timeout=2 http://pangolin:3001/api/v1/ 2>&1 || echo "Cannot reach on 3001"

echo -e "\nChecking /etc/hosts in Gerbil:"
sudo docker exec gerbil cat /etc/hosts | grep pangolin || echo "No pangolin entry in /etc/hosts"

echo -e "\nGerbil's view of network:"
sudo docker exec gerbil ip addr show | grep inet