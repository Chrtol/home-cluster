import re
from datetime import datetime

# Get HTML from previous HTTP Request node
html_content = items[0]['json']['data']

# Initialize result
result = {
    "unread_notifications": 0,  # From bell icon
    "total_notifications": 0,   # From table
    "hnr_count": 0,
    "hnr_details": [],
    "ratio": "0.000",
    "timestamp": datetime.now().isoformat(),
    "status": "success",
    "alerts": [],
    "notification_details": [],
    "new_notifications": 0,  # Notifications from today
    "new_hnrs": 0  # New HnRs detected
}

try:
    # Extract unread notification count from bell icon
    bell_pattern = r'<i[^>]*class="[^"]*fa-bell[^"]*"[^>]*></i>\s*(\d+)'
    bell_match = re.search(bell_pattern, html_content)
    
    if bell_match:
        result["unread_notifications"] = int(bell_match.group(1))
    
    # Extract Hit and Run count - check if we're on HnR page or notifications page
    if '/hnr' in html_content or 'Hit and Runs' in html_content or 'profile/' in html_content and '/hnr' in html_content:
        # We're on the HnR page - look for table rows with torrent links
        # First check if there's a "no HnRs" message
        if "You currently have no Hit and Runs" in html_content or "No torrents found" in html_content:
            result["hnr_count"] = 0
            result["hnr_details"] = []
        else:
            # Look for any torrent links in table rows (more flexible pattern)
            # Pattern 1: Find all torrent links first
            torrent_links = re.findall(r'<a[^>]*href="/torrent/(\d+)"[^>]*>([^<]+)</a>', html_content)
            
            if torrent_links:
                result["hnr_count"] = len(torrent_links)
                
                # For each torrent, try to extract additional info from the table row
                for torrent_id, torrent_name in torrent_links:
                    clean_name = re.sub(r'&[^;]+;', '', torrent_name.strip())
                    
                    # Try to find the table row containing this torrent
                    row_pattern = fr'<tr[^>]*>.*?<a[^>]*href="/torrent/{torrent_id}"[^>]*>{re.escape(torrent_name)}</a>.*?</tr>'
                    row_match = re.search(row_pattern, html_content, re.DOTALL)
                    
                    size = "Unknown"
                    date_added = "Unknown"
                    time_left = "Unknown"
                    
                    if row_match:
                        # Extract table cells from the matched row
                        row_html = row_match.group(0)
                        cells = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.DOTALL)
                        
                        # Assuming typical HnR table structure: Name | Size | Date | Time Left
                        if len(cells) >= 4:
                            size = re.sub(r'<[^>]+>', '', cells[1]).strip()
                            date_added = re.sub(r'<[^>]+>', '', cells[2]).strip()  
                            time_left = re.sub(r'<[^>]+>', '', cells[3]).strip()
                    
                    hnr_detail = {
                        "torrent_id": torrent_id,
                        "name": clean_name,
                        "size": size,
                        "date_added": date_added,
                        "time_left": time_left
                    }
                    result["hnr_details"].append(hnr_detail)
            else:
                # Look for HnR table rows with onclick torrent references
                table_rows = re.findall(r'<tr[^>]*>.*?</tr>', html_content, re.DOTALL)
                data_rows = [row for row in table_rows if '<th' not in row and len(re.findall(r'<td', row)) >= 5]
                
                if len(data_rows) > 0:
                    result["hnr_count"] = len(data_rows)
                    
                    # Parse each HnR row for detailed info
                    for i, row in enumerate(data_rows):
                        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
                        
                        # Extract torrent ID from onclick event
                        onclick_match = re.search(r"onclick=\"window\.location='\/torrent\/(\d+)'\"", row)
                        torrent_id = onclick_match.group(1) if onclick_match else f"unknown_{i}"
                        
                        # Parse table cells: Torrent | Downloaded | Uploaded | Ratio | Seeding Time
                        torrent_name = "Unknown torrent"
                        downloaded = "Unknown"
                        uploaded = "Unknown"
                        ratio = "Unknown"  
                        seeding_time = "Unknown"
                        
                        if len(cells) >= 5:
                            torrent_name = re.sub(r'<[^>]+>', '', cells[0]).strip()
                            downloaded = re.sub(r'<[^>]+>', '', cells[1]).strip()
                            uploaded = re.sub(r'<[^>]+>', '', cells[2]).strip()
                            ratio = re.sub(r'<[^>]+>', '', cells[3]).strip()
                            seeding_time = re.sub(r'<[^>]+>', '', cells[4]).strip()
                        
                        result["hnr_details"].append({
                            "torrent_id": torrent_id,
                            "name": torrent_name,
                            "downloaded": downloaded,
                            "uploaded": uploaded,
                            "ratio": ratio,
                            "seeding_time": seeding_time
                        })
                else:
                    result["hnr_count"] = 0
                    result["hnr_details"] = []
    else:
        # Fallback to icon-based detection for notifications page
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
        '<li><a href="/profile/',
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
    
    # Get recent timeframe for filtering new notifications (last 2 hours)
    from datetime import timedelta
    recent_cutoff = datetime.now() - timedelta(hours=2)
    recent_cutoff_str = recent_cutoff.strftime("%Y-%m-%d %H")
    new_recent = 0
    
    # Process notifications
    for i, (sent_timestamp, sent_date, read_timestamp, read_date, message) in enumerate(notification_rows):
        # Clean up HTML tags from message
        clean_message = re.sub(r'<[^>]+>', '', message).strip()
        
        # Check if sent recently (last 2 hours) to avoid hourly repeats
        sent_hour = sent_date[:13]  # "2025-08-10 20" format
        if sent_hour >= recent_cutoff_str:
            new_recent += 1
            result["alerts"].append(f"Recent notification: {clean_message[:50]}...")
        
        # Add to details (limit to 3 most recent) - return as string for Discord
        if i < 3:
            short_message = clean_message[:80] + "..." if len(clean_message) > 80 else clean_message
            result["notification_details"].append(short_message)
    
    result["new_notifications"] = new_recent
    
    # Check for achievements
    if '<sup style="color:red;">new</sup>' in html_content:
        result["alerts"].append("New achievements available")
    
    # Add contextual alerts with HnR details
    if result["hnr_count"] > 0:
        result["alerts"].append(f"HnR Warning: {result['hnr_count']} torrents")
        
        # Add details for first few HnRs
        for i, hnr in enumerate(result["hnr_details"][:2]):  # Limit to first 2
            if hnr.get("name"):
                short_name = hnr["name"][:25] + "..." if len(hnr["name"]) > 25 else hnr["name"]
                ratio_info = f" (ratio: {hnr.get('ratio', 'unknown')})" if hnr.get('ratio', 'Unknown') != 'Unknown' else ""
                seeding_info = f" - seeded {hnr.get('seeding_time', 'unknown time')}" if hnr.get('seeding_time', 'Unknown') != 'Unknown' else ""
                result["alerts"].append(f"HnR {i+1}: {short_name}{ratio_info}{seeding_info}")
    
    if result["unread_notifications"] > 0:
        result["alerts"].append(f"{result['unread_notifications']} unread notifications")
    
    if result["total_notifications"] > 0:
        result["alerts"].append(f"{result['total_notifications']} total notifications in history")
    
    if new_recent > 0:
        result["alerts"].append(f"{new_recent} notifications received recently")

    # Calculate new HnRs by comparing with previous state (if available from workflow memory)
    # This needs to be passed from the workflow's previous execution data
    previous_hnr_count = items[0].get('json', {}).get('last_hnr_count', 0)
    if result["hnr_count"] > previous_hnr_count:
        result["new_hnrs"] = result["hnr_count"] - previous_hnr_count
    else:
        result["new_hnrs"] = 0
        
except Exception as e:
    result["status"] = "error"
    result["alerts"].append(f"Parser error: {str(e)}")

# Return result for n8n
return [{"json": result}]