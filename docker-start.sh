#!/bin/bash
set -e

echo "==> Starting PortAL..."

# Run Django migrations and collectstatic
echo "==> Running database migrations..."
cd /app/backend
python manage.py migrate --noinput 2>&1 || echo "WARN: Migration failed (DB may not be ready yet)"

echo "==> Collecting static files..."
python manage.py collectstatic --noinput 2>&1 || true

# Start Daphne first, in the background. Daphne serves both HTTP (the Django
# ASGI app behind nginx) and the Channels websockets on /ws/, and it is a
# declared dependency (requirements.txt: daphne>=4.2). The previous command
# asked gunicorn for gunicorn.workers.gtornado.TornadoWorker, which requires
# the separate `tornado` package that was never in requirements.txt, so
# gunicorn crashed on boot and every container deployment stayed down while
# Render kept serving the last image that did start.
echo "==> Starting Daphne..."
daphne -b 127.0.0.1 -p 8000 portal.asgi:application &
DAPHNE_PID=$!

# Only open nginx to the outside world once Django is actually accepting
# connections. Otherwise every restart shows visitors nginx's "502 Bad
# Gateway" page while the app is still booting (or migrations run).
echo "==> Waiting for Django to listen on :8000..."
LISTENING=0
for _ in $(seq 1 90); do
    if ! kill -0 "$DAPHNE_PID" 2>/dev/null; then
        echo "ERROR: Daphne exited during startup (see logs above)"
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

# Keep the container alive while Daphne runs; stop nginx cleanly on exit.
trap 'nginx -s quit 2>/dev/null || true' EXIT
wait "$DAPHNE_PID"
