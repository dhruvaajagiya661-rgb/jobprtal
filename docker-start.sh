#!/bin/bash
set -e

echo "==> Starting PortAL..."

# Report which deployment settings actually arrived on this instance. Names
# only — never values — because a missing SECRET_KEY, DB_HOST or DATABASE_URL
# is the difference between a working deploy and one that Render silently
# rolls back to the previous (older) image, which is very hard to spot from
# the outside.
echo "==> Environment (set/missing):"
for VAR in SECRET_KEY DEBUG DATABASE_URL DB_HOST DB_NAME REDIS_URL SITE_URL; do
    if [ -n "$(printenv "$VAR")" ]; then
        echo "    $VAR = set"
    else
        echo "    $VAR = MISSING"
    fi
done

# Run Django migrations and collectstatic
echo "==> Running database migrations..."
cd /app/backend
python manage.py migrate --noinput 2>&1 || echo "WARN: Migration failed (DB may not be ready yet)"

echo "==> Collecting static files..."
python manage.py collectstatic --noinput 2>&1 || true

# Fail visibly (with the reason) rather than with nginx's bare 502 page: this
# prints any configuration error — missing SECRET_KEY, unusable database —
# straight into the Render log while the container is still starting.
echo "==> Checking Django configuration..."
python manage.py check 2>&1 || echo "WARN: manage.py check reported problems (see above)"

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

# Render (like most PaaS) announces the port the router will talk to via
# $PORT. nginx.conf listens on 80; add the platform's port as a second listener
# when it differs, so the health check and the router reach us either way
# instead of the deploy timing out and being rolled back.
PORT="${PORT:-80}"
if [ "$PORT" != "80" ]; then
    echo "==> Adding nginx listener on port $PORT"
    # Two directives on one line is valid nginx, and a plain literal
    # substitution keeps this free of backreferences and embedded newlines.
    sed -i "s|listen 80;|listen 80; listen ${PORT};|" /etc/nginx/nginx.conf
fi

echo "==> Starting nginx..."
# Validate the config first: on a syntax error nginx exits non-zero and, with
# `set -e`, the container would die with no explanation in the log.
if ! nginx -t 2>&1; then
    echo "ERROR: nginx configuration test failed — aborting startup"
    exit 1
fi
nginx

# Keep the container alive while Daphne runs; stop nginx cleanly on exit.
trap 'nginx -s quit 2>/dev/null || true' EXIT
wait "$DAPHNE_PID"
