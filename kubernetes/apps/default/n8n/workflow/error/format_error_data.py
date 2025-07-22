# N8N Error Workflow - Format Error Data (Python)
# This script formats error data for Discord webhook

from datetime import datetime

# Get error data from N8N (correct N8N Python syntax)
items = _input.all()
error_data = items[0]['json']

# Extract error information with safe fallbacks
workflow_name = error_data.get('workflow', {}).get('name', 'Unknown Workflow')
node_name = error_data.get('node', {}).get('name', 'Unknown Node')
error_name = error_data.get('error', {}).get('name', 'Unknown Error')
error_message = error_data.get('error', {}).get('message', 'No error message available')
execution_id = error_data.get('execution', {}).get('id', 'Unknown')

# Format timestamp
timestamp = error_data.get('timestamp')
if timestamp:
    try:
        formatted_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S UTC')
    except:
        formatted_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
else:
    formatted_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')

# Create Discord embed
discord_embed = {
    "embeds": [
        {
            "title": "🚨 N8N Workflow Error",
            "color": 16711680,  # Red color
            "fields": [
                {
                    "name": "Workflow",
                    "value": workflow_name,
                    "inline": True
                },
                {
                    "name": "Node",
                    "value": node_name,
                    "inline": True
                },
                {
                    "name": "Error Type",
                    "value": error_name,
                    "inline": True
                },
                {
                    "name": "Error Message",
                    "value": error_message[:1000] + "..." if len(error_message) > 1000 else error_message,
                    "inline": False
                },
                {
                    "name": "Timestamp",
                    "value": formatted_time,
                    "inline": True
                },
                {
                    "name": "Execution ID",
                    "value": execution_id,
                    "inline": True
                }
            ],
            "footer": {
                "text": "N8N Error Handler"
            },
            "timestamp": datetime.now().isoformat()
        }
    ]
}

# Return formatted data for Discord webhook
return discord_embed