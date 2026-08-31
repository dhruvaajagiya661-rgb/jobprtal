"""
Custom Django email backends.

The stock console backend writes with the terminal's locale encoding (cp1252
on Windows), which crashes on emoji-rich HTML emails like the welcome
template ("charmap codec can't encode character '\U0001f680'"). This backend
writes raw UTF-8 bytes to stdout instead, so dev emails render fully in the
server log regardless of locale.
"""

import sys

from django.core.mail.backends.console import EmailBackend as ConsoleEmailBackend


class ConsoleUTF8EmailBackend(ConsoleEmailBackend):
    """Console backend that emits UTF-8, bypassing the locale encoding."""

    def write_message(self, message):
        """Write the rendered message to stdout as raw UTF-8 bytes.

        ``message.message()`` (a MIMEMultipart) has no charset of its own, so
        ``as_bytes()`` returns the fully-encoded message; decoding with the
        message charset then re-encoding as UTF-8 keeps the body intact while
        making it safe for cp1252 consoles. Writing straight to
        ``sys.stdout.buffer`` bypasses the text layer's locale encoding.
        """
        msg = message.message()
        charset = msg.get_charset()
        payload = msg.as_bytes()
        if charset:
            # get_charset() returns an email.charset.Charset, not a str, and
            # bytes.decode() rejects it -- take the codec name off it. Fall
            # back to a lossy UTF-8 decode rather than losing the message.
            codec = getattr(charset, "input_charset", None) or str(charset)
            try:
                payload = payload.decode(codec).encode("utf-8")
            except (LookupError, UnicodeDecodeError):
                payload = payload.decode("utf-8", errors="replace").encode("utf-8")

        buffer = getattr(sys.stdout, "buffer", None)
        if buffer is not None:
            # Flush any buffered text-layer output first to keep ordering sane.
            sys.stdout.flush()
            buffer.write(payload + b"\n")
            buffer.flush()
        else:
            sys.stdout.write(payload.decode("utf-8", errors="replace") + "\n")
