import logging


class HealthCheckFilter(logging.Filter):
    """Filter out successful health check requests from logs"""

    def filter(self, record: logging.LogRecord) -> bool:
        # Only filter uvicorn.access logs
        if record.name != "uvicorn.access":
            return True
        # Filter out successful health checks (200 OK)
        message = record.getMessage()
        return not ('"GET /health HTTP' in message and '200 OK' in message)
