-- Alert logging database schema for N8N silent logging

CREATE TABLE IF NOT EXISTS alert_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    severity TEXT NOT NULL,
    namespace TEXT,
    alertname TEXT NOT NULL,
    summary TEXT,
    description TEXT,
    status TEXT NOT NULL,
    fingerprint TEXT UNIQUE,
    instance TEXT,
    routing_decision TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at DATETIME,
    resolved_at DATETIME
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_logs_timestamp ON alert_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_logs_severity ON alert_logs(severity);
CREATE INDEX IF NOT EXISTS idx_alert_logs_namespace ON alert_logs(namespace);
CREATE INDEX IF NOT EXISTS idx_alert_logs_status ON alert_logs(status);
CREATE INDEX IF NOT EXISTS idx_alert_logs_fingerprint ON alert_logs(fingerprint);

-- View for daily summaries
CREATE VIEW IF NOT EXISTS daily_alert_summary AS
SELECT 
    DATE(timestamp) as alert_date,
    COUNT(*) as total_alerts,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_count,
    COUNT(CASE WHEN severity = 'info' THEN 1 END) as info_count,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count
FROM alert_logs
GROUP BY DATE(timestamp)
ORDER BY alert_date DESC;

-- View for routing metrics
CREATE VIEW IF NOT EXISTS routing_metrics AS
SELECT 
    routing_decision,
    COUNT(*) as count,
    AVG(CASE WHEN resolved_at IS NOT NULL THEN 
        (julianday(resolved_at) - julianday(timestamp)) * 24 * 60 
        ELSE NULL END) as avg_resolution_time_minutes
FROM alert_logs
WHERE timestamp >= datetime('now', '-30 days')
GROUP BY routing_decision
ORDER BY count DESC;

-- View for alert patterns
CREATE VIEW IF NOT EXISTS alert_patterns AS
SELECT 
    alertname,
    namespace,
    COUNT(*) as occurrence_count,
    MIN(timestamp) as first_seen,
    MAX(timestamp) as last_seen,
    AVG(CASE WHEN resolved_at IS NOT NULL THEN 
        (julianday(resolved_at) - julianday(timestamp)) * 24 * 60 
        ELSE NULL END) as avg_resolution_time_minutes
FROM alert_logs
WHERE timestamp >= datetime('now', '-30 days')
GROUP BY alertname, namespace
HAVING occurrence_count > 1
ORDER BY occurrence_count DESC;