#!/usr/bin/env python3
"""
Celery worker entrypoint for notification tasks
"""
import logging
from app.celery_app import celery_app

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Starting Celery worker for notification tasks...")
    celery_app.worker_main([
        'worker',
        '--loglevel=info',
        '--concurrency=2',  # Process 2 tasks concurrently
        '--queues=notifications',  # Only process notification queue
        '--max-tasks-per-child=1000',  # Restart worker after 1000 tasks
    ])
