# Backup Summary Workflow Setup

This workflow generates a daily backup summary including both VolSync and PostgreSQL backups.

## Setup Instructions

### 1. Add PostgreSQL Backup Query to n8n Workflow

In your n8n backup summary workflow, add a **Code** node to fetch PostgreSQL backup status:

**Node Name**: Fetch PostgreSQL Backups

**Code**:
```python
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

    return [{"json": result}]

except Exception as e:
    # Return error in Prometheus format
    error_result = {
        "status": "error",
        "errorType": "execution",
        "error": str(e)
    }
    return [{"json": error_result}]
```

### 2. Workflow Structure

Your backup summary workflow should look like this:

```
Schedule Trigger (daily 8am)
  ├─> HTTP Request: Query Prometheus for VolSync metrics
  │
  ├─> Code: Fetch PostgreSQL Backups (NEW - code above)
  │
  └─> Code: Transform Data (transform.js)
        - Receives both inputs via $input.all()
        - Input [0]: VolSync metrics
        - Input [1]: PostgreSQL metrics
      │
      └─> Code: Format for Discord (format_discord.js)
          │
          └─> HTTP Request: Send to Discord Webhook
```

### 3. Transform Node Configuration

The transform node should receive BOTH the VolSync HTTP Request and PostgreSQL Code node outputs.

Connect both nodes to the transform node in parallel.

## Files

- `transform.js` - Processes both VolSync and PostgreSQL backup data
- `format_discord.js` - Formats the summary for Discord
- `fetch_postgres_backup.py` - Python code for the PostgreSQL backup query node

## RBAC

The RBAC configuration in `../app/backup-reader-rbac.yaml` grants the n8n pod permission to read PostgreSQL backup CRDs from the Kubernetes API.

## Testing

After setup, trigger the workflow manually to test. You should see:

```
🟢 Daily Backup Report - [Date]
▓▓▓▓▓▓▓▓▓▓ 100% Success Rate

📊 SUMMARY
  VolSync: ✅ 21 Successful  ❌ 0 Failed
  PostgreSQL: ✅ 1 Successful  ❌ 0 Failed
  📦 218GB  🕐 4m 32s avg

🗄️ POSTGRESQL (1/1 ✅)
✅ postgres17

🏠 DEFAULT (6/6 ✅)
...
```
