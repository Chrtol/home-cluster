#!/usr/bin/env python3
"""
Fetch PostgreSQL backup status from Kubernetes API
This uses the mounted service account token to query the k8s API
"""
import json
import requests
import os
from datetime import datetime

# Configuration
NAMESPACE = "database"
CLUSTER = "postgres17"

# Kubernetes API setup
SA_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token"
CA_CERT_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
KUBE_API = "https://kubernetes.default.svc"

try:
    # Read service account token
    with open(SA_TOKEN_PATH, 'r') as f:
        token = f.read().strip()

    # Query Kubernetes API for backups
    url = f"{KUBE_API}/apis/postgresql.cnpg.io/v1/namespaces/{NAMESPACE}/backups"
    params = {"labelSelector": f"cnpg.io/cluster={CLUSTER}"}
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(url, params=params, headers=headers, verify=CA_CERT_PATH)
    response.raise_for_status()

    backups = response.json()

    # Get the latest backup
    if backups.get('items'):
        sorted_backups = sorted(
            backups['items'],
            key=lambda x: x['metadata']['creationTimestamp']
        )
        latest_backup = sorted_backups[-1]

        # Check if backup was successful
        phase = latest_backup.get('status', {}).get('phase', 'unknown')
        status_value = "1" if phase == "completed" else "0"

        # Format response to match Prometheus metric format
        result = {
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": [{
                    "metric": {
                        "cluster": latest_backup['spec']['cluster']['name'],
                        "namespace": latest_backup['metadata']['namespace']
                    },
                    "value": [
                        str(int(datetime.now().timestamp())),
                        status_value
                    ]
                }]
            }
        }
    else:
        # No backups found
        result = {
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": []
            }
        }

    print(json.dumps(result))

except Exception as e:
    # Return error in Prometheus format
    error_result = {
        "status": "error",
        "errorType": "execution",
        "error": str(e)
    }
    print(json.dumps(error_result))
    exit(1)
