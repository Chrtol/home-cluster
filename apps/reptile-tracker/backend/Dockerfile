FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && pip list

# Copy application code
COPY app ./app
COPY migrations ./migrations
COPY entrypoint.sh ./entrypoint.sh
COPY entrypoint-celery.sh ./entrypoint-celery.sh
COPY debug_startup.py ./debug_startup.py
COPY logging_config.json ./logging_config.json
COPY cleanup_duplicate_templates.py ./cleanup_duplicate_templates.py
COPY celery_worker.py ./celery_worker.py
RUN chmod +x ./entrypoint.sh ./entrypoint-celery.sh

# Create photos directory for storage volume mount
RUN mkdir -p /app/photos

# Create non-root user and set ownership
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Use entrypoint to run migrations then start the app
ENTRYPOINT ["/app/entrypoint.sh"]
