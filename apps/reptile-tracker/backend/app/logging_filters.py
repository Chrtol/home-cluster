import logging


class HealthCheckFilter(logging.Filter):
    """Filter out successful health check requests from logs"""

    def filter(self, record: logging.LogRecord) -> bool:
        # Only filter uvicorn.access logs
        if record.name != "uvicorn.access":
            return True
        # Filter out successful health checks (200 OK)
        # Check both the formatted message and the raw message
        message = record.getMessage()
        # The message format from uvicorn is: "client_addr - \"request_line\" status_code"
        if "/health" in message and "200" in message:
            return False
        return True
