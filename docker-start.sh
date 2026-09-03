#!/bin/bash
set -e

echo "==> Starting PortAL..."

# Run Django migrations and collectstatic
echo "==> Running database migrations..."
cd /app/backend
python manage.py migrate --noinput 2>&1 || echo "WARN: Migration failed (DB may not be ready yet)"

echo "==> Collecting static files..."
python manage.py collectstatic --noinput 2>&1 || true

# Start gunicorn first, in the background.
echo "==> Starting gunicorn..."
gunicorn portal.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers 3 \
    --worker-class gunicorn.workers.gtornado.TornadoWorker \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --timeout 30 \
    --access-logfile - \
    --error-logfile - &
GUNICORN_PID=$!

# Only open nginx to the outside world once Django is actually accepting
# connections. Otherwise every restart shows visitors nginx's "502 Bad
# Gateway" page while gunicorn is still booting (or migrations run).
echo "==> Waiting for Django to listen on :8000..."
LISTENING=0
for _ in $(seq 1 90); do
    if ! kill -0 "$GUNICORN_PID" 2>/dev/null; then
        echo "ERROR: gunicorn exited during startup (see logs above)"
        exit 1
    fi
    if python -c "import socket,sys; s=socket.socket(); s.settimeout(1); sys.exit(0 if s.connect_ex(('127.0.0.1',8000))==0 else 1)" 2>/dev/null; then
        LISTENING=1
        break
    fi
    sleep 1
done

if [ "$LISTENING" != "1" ]; then
    echo "ERROR: Django did not become ready within 90s — aborting startup"
    exit 1
fi

echo "==> Starting nginx..."
nginx

# Keep the container alive while gunicorn runs; stop nginx cleanly on exit.
trap 'nginx -s quit 2>/dev/null || true' EXIT
wait "$GUNICORN_PID"
