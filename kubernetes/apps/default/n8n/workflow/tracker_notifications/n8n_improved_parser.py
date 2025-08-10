import re
from datetime import datetime

# Get HTML from previous HTTP Request node
html_content = items[0]['json']['data']

# Initialize result
result = {
    "unread_notifications": 0,  # From bell icon
    "total_notifications": 0,   # From table
    "hnr_count": 0,
    "ratio": "0.000",
    "timestamp": datetime.now().isoformat(),
    "status": "success",
    "alerts": [],
    "notification_details": [],
    "new_notifications": 0  # Notifications from today
}

try:
    # Extract unread notification count from bell icon
    bell_pattern = r'<i[^>]*class="[^"]*fa-bell[^"]*"[^>]*></i>\s*(\d+)'
    bell_match = re.search(bell_pattern, html_content)
    
    if bell_match:
        result["unread_notifications"] = int(bell_match.group(1))
    
    # Extract Hit and Run count
    hnr_pattern = r'<i[^>]*class="[^"]*fa-ban[^"]*"[^>]*></i>\s*(\d+)'
    hnr_match = re.search(hnr_pattern, html_content)
    
    if hnr_match:
        result["hnr_count"] = int(hnr_match.group(1))
    
    # Extract ratio
    ratio_pattern = r'<i[^>]*class="[^"]*fa-percent[^"]*"[^>]*></i>\s*([\d.]+)'
    ratio_match = re.search(ratio_pattern, html_content)
    
    if ratio_match:
        result["ratio"] = ratio_match.group(1)
    
    # Check login status
    logged_in = False
    login_indicators = [
        'class="tl loggedin"',
        'onclick="window.location.href=\'/user/account/logout\'"',
        '<li><a href="/profile/vrtol/notifications"',
        'var userLogUserID'
    ]
    
    for indicator in login_indicators:
        if indicator in html_content:
            logged_in = True
            break
    
    if not logged_in:
        result["status"] = "error"
        result["alerts"].append("Session expired - not logged in")
    
    # Parse notification table for total count and details
    notification_rows = re.findall(r'<tr[^>]*>.*?<td data-sort="(\d+)">([^<]+)</td>.*?<td data-sort="(\d+)">([^<]*)</td>.*?<td class="notificationMessageTD">(.*?)</td>.*?</tr>', html_content, re.DOTALL)
    
    result["total_notifications"] = len(notification_rows)
    
    # Get today's date for filtering new notifications
    today = datetime.now().strftime("%Y-%m-%d")
    new_today = 0
    
    # Process notifications
    for i, (sent_timestamp, sent_date, read_timestamp, read_date, message) in enumerate(notification_rows):
        # Clean up HTML tags from message
        clean_message = re.sub(r'<[^>]+>', '', message).strip()
        
        # Check if sent today
        if today in sent_date:
            new_today += 1
            result["alerts"].append(f"New notification today: {clean_message[:50]}...")
        
        # Add to details (limit to 3 most recent)
        if i < 3:
            result["notification_details"].append({
                "sent": sent_date,
                "read": read_date if read_date else "Unread",
                "message": clean_message[:100] + "..." if len(clean_message) > 100 else clean_message
            })
    
    result["new_notifications"] = new_today
    
    # Check for achievements
    if '<sup style="color:red;">new</sup>' in html_content:
        result["alerts"].append("New achievements available")
    
    # Add contextual alerts
    if result["hnr_count"] > 0:
        result["alerts"].append(f"HnR Warning: {result['hnr_count']} torrents")
    
    if result["unread_notifications"] > 0:
        result["alerts"].append(f"{result['unread_notifications']} unread notifications")
    
    if result["total_notifications"] > 0:
        result["alerts"].append(f"{result['total_notifications']} total notifications in history")
    
    if new_today > 0:
        result["alerts"].append(f"{new_today} notifications received today")
        
except Exception as e:
    result["status"] = "error"
    result["alerts"].append(f"Parser error: {str(e)}")

# Return result for n8n
return [{"json": result}]