#!/usr/bin/env python
"""One-command development launcher for PortAL.

    python dev.py            # start the API and the SPA together
    python dev.py --seed     # ...and load demo data first
    python dev.py --check    # verify the environment, start nothing

Runs the Django API on :8000 and the Vite dev server on :5173, interleaving
both logs with a colour-coded prefix so you can watch one terminal instead of
two. Ctrl+C stops both cleanly.

Works on Windows, macOS and Linux — npm resolves to npm.cmd on Windows, and
signals are handled per-platform.
"""

from __future__ import annotations

import argparse
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# The launcher lives in backend/; the SPA lives at the repo root.
FRONTEND = ROOT.parent / "frontend"
IS_WINDOWS = os.name == "nt"

API_PORT = 8000
WEB_PORT = 5173


def _prepare_console() -> bool:
    """Make the console UTF-8 and ANSI-capable; report whether colour works.

    Windows consoles default to a legacy codepage (cp1252), which raises on the
    box-drawing and tick characters below, and need VT processing switched on
    before ANSI escapes render instead of printing as garbage.
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    if IS_WINDOWS:
        try:
            import ctypes

            kernel32 = ctypes.windll.kernel32
            # -11 = STD_OUTPUT_HANDLE, 0x4 = ENABLE_VIRTUAL_TERMINAL_PROCESSING
            handle = kernel32.GetStdHandle(-11)
            mode = ctypes.c_uint32()
            if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
                kernel32.SetConsoleMode(handle, mode.value | 0x4)
        except Exception:
            return False

    return sys.stdout.isatty()


# ANSI colours; disabled when the output isn't a terminal.
_TTY = _prepare_console()


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _TTY else text


DIM = lambda s: _c("2", s)          # noqa: E731
BOLD = lambda s: _c("1", s)         # noqa: E731
GREEN = lambda s: _c("32", s)       # noqa: E731
RED = lambda s: _c("31", s)         # noqa: E731
YELLOW = lambda s: _c("33", s)      # noqa: E731
CYAN = lambda s: _c("36", s)        # noqa: E731
MAGENTA = lambda s: _c("35", s)     # noqa: E731


def info(msg: str) -> None:
    print(f"{DIM('›')} {msg}")


def ok(msg: str) -> None:
    print(f"{GREEN('✓')} {msg}")


def warn(msg: str) -> None:
    print(f"{YELLOW('!')} {msg}")


def fail(msg: str) -> None:
    print(f"{RED('✗')} {msg}")


def npm_command() -> str | None:
    """npm is a .cmd shim on Windows; shutil.which handles PATHEXT for us."""
    return shutil.which("npm.cmd") if IS_WINDOWS else shutil.which("npm")


def port_busy(port: int) -> bool:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        # A successful connect means something is already listening.
        return sock.connect_ex(("127.0.0.1", port)) == 0


def preflight(strict: bool = True) -> bool:
    """Check everything needed to boot. Returns False if something is fatal."""
    healthy = True
    print(BOLD("\nPortAL — environment check\n"))

    py = sys.version_info
    if py >= (3, 10):
        ok(f"Python {py.major}.{py.minor}.{py.micro}")
    else:
        fail(f"Python {py.major}.{py.minor} — 3.10+ required")
        healthy = False

    try:
        import django

        ok(f"Django {django.get_version()}")
    except ImportError:
        fail("Django not installed — run: pip install -r requirements.txt")
        healthy = False

    try:
        import pypdf  # noqa: F401

        ok("pypdf (resume parsing)")
    except ImportError:
        warn("pypdf missing — resume parsing will be disabled")

    env = ROOT / ".env"
    if env.exists():
        ok(".env present")
    else:
        # Django loads backend/.env, but the checked-in env lives at the repo
        # root (used by docker-compose too) — copy it into place if possible.
        example = ROOT / ".env.example"
        root_env = ROOT.parent / ".env"
        if root_env.exists():
            shutil.copy(root_env, env)
            ok(".env copied from repo root")
        elif example.exists():
            shutil.copy(example, env)
            ok(".env created from .env.example")
        else:
            fail(".env missing and no .env.example to copy")
            healthy = False

    npm = npm_command()
    if npm:
        ok("npm found")
    else:
        fail("npm not found — install Node.js 18+")
        healthy = False

    if (FRONTEND / "node_modules").is_dir():
        ok("frontend dependencies installed")
    elif npm:
        warn("frontend/node_modules missing — installing now (one-off)")
        result = subprocess.run([npm, "install"], cwd=FRONTEND)
        if result.returncode == 0:
            ok("frontend dependencies installed")
        else:
            fail("npm install failed")
            healthy = False

    for port, label in ((API_PORT, "API"), (WEB_PORT, "web")):
        if port_busy(port):
            fail(f"port {port} ({label}) is already in use")
            healthy = False
        else:
            ok(f"port {port} free ({label})")

    print()
    if not healthy and strict:
        fail("Fix the problems above, then run again.\n")
    return healthy


def run_migrations() -> bool:
    info("applying migrations…")
    result = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--noinput"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        fail("migrations failed:")
        print(result.stdout[-2000:])
        print(result.stderr[-2000:])
        return False
    ok("database up to date")
    return True


def run_seed() -> bool:
    seed = ROOT / "seed_data.py"
    if not seed.exists():
        warn("seed_data.py not found — skipping")
        return True
    info("loading demo data…")
    result = subprocess.run([sys.executable, str(seed)], cwd=ROOT)
    if result.returncode != 0:
        warn("seeding reported an error — continuing anyway")
        return True
    ok("demo data loaded")
    return True


def pump(stream, prefix: str) -> None:
    """Forward a child's output line by line with a prefix."""
    for raw in iter(stream.readline, ""):
        if raw:
            sys.stdout.write(f"{prefix} {raw.rstrip()}\n")
            sys.stdout.flush()
    stream.close()


def spawn(cmd: list[str], cwd: Path, prefix: str) -> subprocess.Popen:
    # A new process group lets us stop the child and anything it spawned
    # (Vite forks esbuild) rather than orphaning them on Ctrl+C.
    kwargs: dict = {}
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True

    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace",
        **kwargs,
    )
    threading.Thread(target=pump, args=(proc.stdout, prefix), daemon=True).start()
    return proc


def stop(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    try:
        if IS_WINDOWS:
            proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except Exception:
        pass
    try:
        proc.wait(timeout=6)
    except subprocess.TimeoutExpired:
        proc.kill()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run PortAL in development.")
    parser.add_argument("--seed", action="store_true", help="load demo data before starting")
    parser.add_argument("--check", action="store_true", help="run the environment check only")
    parser.add_argument("--no-migrate", action="store_true", help="skip migrations")
    parser.add_argument("--api-only", action="store_true", help="start only the Django API")
    args = parser.parse_args()

    if args.check:
        return 0 if preflight(strict=False) else 1

    if not preflight():
        return 1

    if not args.no_migrate and not run_migrations():
        return 1

    if args.seed and not run_seed():
        return 1

    procs: list[subprocess.Popen] = []
    print(BOLD("\nStarting PortAL\n"))

    procs.append(
        spawn(
            [sys.executable, "manage.py", "runserver", str(API_PORT)],
            ROOT,
            CYAN("[api]"),
        )
    )

    if not args.api_only:
        npm = npm_command()
        if not npm:
            fail("npm disappeared between the check and launch")
            stop(procs[0])
            return 1
        procs.append(spawn([npm, "run", "dev"], FRONTEND, MAGENTA("[web]")))

    time.sleep(2.5)
    print()
    ok(f"API   {BOLD(f'http://127.0.0.1:{API_PORT}')}   (admin at /admin/, docs at /api/docs/)")
    if not args.api_only:
        # Vite binds the localhost name only — 127.0.0.1 will refuse the
        # connection, which is a confusing five minutes if you don't know.
        ok(f"Web   {BOLD(f'http://localhost:{WEB_PORT}')}   {DIM('(use localhost, not 127.0.0.1)')}")
    print(DIM("\nPress Ctrl+C to stop both.\n"))

    try:
        while True:
            for proc in procs:
                if proc.poll() is not None:
                    fail(f"a process exited with code {proc.returncode} — shutting down")
                    raise KeyboardInterrupt
            time.sleep(0.5)
    except KeyboardInterrupt:
        print(DIM("\nstopping…"))
    finally:
        for proc in procs:
            stop(proc)
        ok("stopped")

    return 0


if __name__ == "__main__":
    sys.exit(main())
