# =============================================================================
# Multi-stage Dockerfile for PortAL
# Stage 1 – Build the React/Vite frontend
# Stage 2 – Install Python dependencies for the Django backend
# Stage 3 – Production image: nginx serves the SPA + proxies API to Django
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build frontend
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Copy source first so npm can resolve platform-specific optional deps
COPY frontend/ ./
RUN rm -rf node_modules package-lock.json && npm install

# Build
RUN npm run build


# ---------------------------------------------------------------------------
# Stage 2: Python dependencies (cached layer)
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS python-deps

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt


# ---------------------------------------------------------------------------
# Stage 3: Production
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS production

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install runtime deps only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from the deps stage
COPY --from=python-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

WORKDIR /app

# Copy backend code
COPY backend/ /app/backend/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Collect Django static files (DEBUG=True and a dummy SECRET_KEY are only
# needed at build time so collectstatic can import settings without error;
# the real values come from docker-compose environment at runtime).
ENV DEBUG=True
ENV SECRET_KEY=build-time-placeholder
RUN cd /app/backend && python manage.py collectstatic --noinput

# Create non-root user for Django
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app/backend/media /app/backend/logs 2>/dev/null || true && \
    mkdir -p /app/backend/logs /app/backend/media && \
    chown -R appuser:appgroup /app/backend/logs /app/backend/media

# Create nginx temp dirs and fix permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R appuser:appgroup /var/cache/nginx /var/log/nginx /var/run

# Copy the startup script
COPY docker-start.sh /docker-start.sh
RUN chmod +x /docker-start.sh

EXPOSE 80

ENTRYPOINT ["/bin/bash", "/docker-start.sh"]
