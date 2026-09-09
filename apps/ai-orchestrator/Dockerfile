FROM python:3.13-slim

WORKDIR /app

# temporalio ships a cp310-abi3 manylinux wheel, so no toolchain is needed.
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
ENV PYTHONPATH=/app/src PYTHONUNBUFFERED=1

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["python", "-m", "orchestrator.worker"]
