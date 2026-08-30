"""Logging utilities for PortAL.

On Windows a log file that is open in another process cannot be renamed, so
``RotatingFileHandler`` rotation fails with ``PermissionError`` (WinError 32)
whenever a second process holds the same log open -- for example the Django
autoreloader parent, which imports settings (and therefore configures logging)
before spawning the server child. The failed rotation is reported by the
logging framework as a "Logging error" block on every request.

``SafeRotatingFileHandler`` closes its stream after every ``emit`` so the file
handle is never held between writes and rotation always succeeds.
"""

from logging.handlers import RotatingFileHandler


class SafeRotatingFileHandler(RotatingFileHandler):
    """A RotatingFileHandler that releases the file after each write.

    Closing the stream after every record makes log rotation reliable on
    Windows even when several processes share the same log file (Django's
    autoreloader parent/child being the most common case in this project).
    """

    def emit(self, record):
        super().emit(record)
        self.close()
