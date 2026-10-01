# Use lightweight official Python 3.11 slim image
FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install minimal OS dependencies required for OpenCV and image processing (DEP-03)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for caching layers
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code, models configuration, and outputs structure
COPY app /app/app
COPY models /app/models
COPY outputs /app/outputs

# Create models and outputs directories if not present
RUN mkdir -p /app/models /app/outputs

# Create non-root user and ensure write permissions for outputs and app directory
RUN useradd -u 10001 -m -s /bin/sh appuser \
    && chown -R appuser:appuser /app

USER appuser

# Health check to ensure microservice and model readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD sh -c 'curl -f "http://localhost:${PORT:-8000}/health"' || exit 1

# Expose microservice HTTP port
EXPOSE 8000

# Run FastAPI app with Uvicorn (binds to Cloud Run $PORT, default 8000)
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]


