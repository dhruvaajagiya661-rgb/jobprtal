# Production Dockerfile for portAL

# Stage 1: Base image
FROM python:3.10-slim as base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Development
FROM base as develop

COPY backend/ /app/backend/
COPY frontend/ /app/frontend/
COPY .env* /app/
ENV DEBUG=1

EXPOSE 8000

CMD ["python", "backend/manage.py", "runserver", "0.0.0.0:8000"]

# Stage 3: Production
FROM base as production

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

COPY backend/ /app/backend/
COPY frontend/ /app/frontend/
COPY .env* /app/
RUN chown -R appuser:appgroup /app

# Collect static files
RUN cd /app/backend && python manage.py collectstatic --noinput

# Create directory for logs
RUN mkdir -p /app/backend/logs && chown -R appuser:appgroup /app/backend/logs

USER appuser

EXPOSE 8000

CMD ["gunicorn", "portal.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--worker-class", "gunicorn.workers.gtornado.TornadoWorker", \
     "--max-requests", "1000", \
     "--timeout", "30", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
