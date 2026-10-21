"""Password-reset email delivery — clean, env-configured abstraction.

Providers (selected via ``MAIL_DRIVER`` or auto-detected from the environment,
never from request data):

* ``resend`` — Resend HTTP API (``RESEND_API_KEY``, ``MAIL_FROM``). No SMTP
  ports needed; ideal on Render/Vercel.
* ``smtp``   — any SMTP server (``SMTP_HOST/PORT/USER/PASSWORD``, STARTTLS on
  587, implicit TLS on 465, ``MAIL_FROM``).
* ``outbox`` — development mailbox: writes the full message as an ``.eml``
  file into ``instance/dev_outbox`` (or ``MAIL_OUTBOX_DIR``). Never used unless
  explicitly requested or auto-selected in a non-production run with no other
  provider. This is the "safe test mail backend" for local development — the
  developer reads the mailbox like a real inbox; **nothing is logged**.
* ``none``   — no delivery configured (auto-selected in production when env
  vars are missing). Requests still answer the generic response; no token is
  disclosed, not even on delivery failure.

Hard rules enforced here:
* Reset tokens never appear in log lines, exception strings that are logged,
  HTTP responses, or outbox *file names*.
* Delivery failures are soft-failed (``('failed', reason)``), never 500s —
  the caller answers with the generic response either way.
"""

from __future__ import annotations

import json
import os
import smtplib
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from urllib.error import URLError

BASE_TEMPLATE_SUBJECT = 'Reset your LinuxDocs password'

EXPLANATION = (
    'You (or someone) asked to reset the password for the LinuxDocs account'
    ' with this address. This link works exactly once and expires in'
    ' 30 minutes. If you did not request it, you can safely ignore this'
    ' message — your password stays unchanged.')


def _driver() -> str:
    """Which delivery backend to use. Explicit env wins; then auto-detect."""
    explicit = (os.getenv('MAIL_DRIVER') or '').strip().lower()
    if explicit in ('resend', 'smtp', 'outbox', 'none'):
        return explicit
    if os.getenv('RESEND_API_KEY'):
        return 'resend'
    if os.getenv('SMTP_HOST') and os.getenv('SMTP_USER') and os.getenv('SMTP_PASSWORD'):
        return 'smtp'
    if os.getenv('FLASK_ENV') == 'production':
        return 'none'
    return 'outbox'            # local development with nothing configured


def is_email_configured() -> bool:
    """True only when a *real* provider is configured. Env-derived — identical
    for every caller, so the flag can never be used to enumerate accounts."""
    return _driver() in ('resend', 'smtp')


def outbox_dir() -> str:
    override = os.getenv('MAIL_OUTBOX_DIR')
    if override:
        return override
    from flask import current_app
    try:
        base = current_app.instance_path
    except RuntimeError:                       # outside app context
        base = os.path.join(os.getcwd(), 'instance')
    return os.path.join(base, 'dev_outbox')


def reset_link(token: str) -> str:
    """Build the reset URL from the trusted, configured frontend origin —
    never from an untrusted request header."""
    base = (os.getenv('FRONTEND_ORIGIN') or '').rstrip('/')
    return f'{base}/password-reset?token={token}'


def _from_header() -> str:
    raw = os.getenv('MAIL_FROM') or os.getenv('SMTP_USER') \
        or 'onboarding@resend.dev'
    if '<' in raw or raw.strip() == raw and '@' in raw:
        return raw.strip()
    return formataddr(('LinuxDocs', raw))


def _message(email: str, username: str, token: str) -> EmailMessage:
    link = reset_link(token)
    plain = (
        f'Hi {username},\n\n{EXPLANATION}\n\n'
        f'Open this one-time link to choose a new password:\n\n{link}\n\n'
        '— LinuxDocs\n')
    html = f"""<div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;max-width:560px;margin:0 auto;background:#1b1817;color:#e8e2dc;border-radius:14px;border:1px solid #3a332f;overflow:hidden">
  <div style="padding:20px 24px;border-bottom:1px solid #3a332f;background:#211d1b">
    <span style="color:#7ee787;font-size:15px;font-weight:700">LinuxDocs</span>
    <span style="color:#8a817b;font-size:13px"> $ password-reset</span>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 12px;font-size:14px">Hi {username},</p>
    <p style="margin:0 0 18px;font-size:14px;color:#c9c2ba">{EXPLANATION}</p>
    <a href="{link}" style="display:block;background:#7ee787;color:#1b1817;font-weight:700;text-align:center;padding:12px 16px;border-radius:8px;text-decoration:none;font-size:14px">Choose a new password</a>
    <p style="margin:18px 0 0;font-size:12px;color:#8a817b;word-break:break-all">{link}</p>
  </div>
</div>"""
    msg = EmailMessage()
    msg['Subject'] = BASE_TEMPLATE_SUBJECT
    msg['From'] = _from_header()
    msg['To'] = email
    msg['Message-ID'] = make_msgid(domain='linuxdocs')
    msg.set_content(plain)
    msg.add_alternative(html, subtype='html')
    return msg


def _send_via_resend(msg: EmailMessage) -> tuple[str, str]:
    payload = {
        'from': msg['From'],
        'to': [msg['To']],
        'subject': msg['Subject'],
        'text': msg.get_body(preferencelist=('plain',)).get_content(),
        'html': msg.get_body(preferencelist=('html',)).get_content(),
    }
    req = urllib.request.Request(
        'https://api.resend.com/emails',
        data=json.dumps(payload).encode(),
        headers={
            'Authorization': f"Bearer {os.getenv('RESEND_API_KEY') or ''}",
            'Content-Type': 'application/json',
        }, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status < 300:
                return 'sent', 'delivered via resend'
            return 'failed', f'resend api returned {resp.status}'
    except (URLError, TimeoutError, OSError) as exc:
        return 'failed', f'resend request failed: {type(exc).__name__}'


def _send_via_smtp(msg: EmailMessage) -> tuple[str, str]:
    host = os.getenv('SMTP_HOST') or ''
    port = int(os.getenv('SMTP_PORT') or '587')
    user = os.getenv('SMTP_USER') or ''
    password = os.getenv('SMTP_PASSWORD') or ''
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.starttls()
                server.login(user, password)
                server.send_message(msg)
        return 'sent', f'delivered via smtp:{host}'
    except (smtplib.SMTPException, OSError) as exc:
        # Exception text may echo server responses — never token material,
        # but keep it short and category-like anyway.
        return 'failed', f'smtp failed: {type(exc).__name__}'


def _send_via_outbox(msg: EmailMessage, token: str) -> tuple[str, str]:
    """Write the message to the dev mailbox. The file name must not leak the
    token — os-safe timestamp + opaque random suffix instead."""
    import secrets
    target = outbox_dir()
    os.makedirs(target, exist_ok=True)
    stamp = __import__('time').strftime('%Y%m%d-%H%M%S')
    name = f'reset-{stamp}-{secrets.token_hex(4)}.eml'
    path = os.path.join(target, name)
    with open(path, 'wb') as fh:
        fh.write(bytes(msg))
    # Guard: the token must never end up in the file name.
    if token and token in name:
        raise AssertionError('token leaked into mailbox file name')
    return 'sent', f'written to dev mailbox ({name})'


def send_reset_email(email: str, username: str, token: str) -> tuple[str, str]:
    """Best-effort delivery. NEVER raises, NEVER returns or logs the token.
    Returns (status, sanitized detail) where status is sent|failed|skipped."""
    driver = _driver()
    try:
        msg = _message(email, username, token)
        if driver == 'resend':
            return _send_via_resend(msg)
        if driver == 'smtp':
            return _send_via_smtp(msg)
        if driver == 'outbox':
            return _send_via_outbox(msg, token)
        return 'skipped', 'no email provider configured'
    except Exception as exc:                       # noqa: BLE001 — must not raise
        return 'failed', f'delivery error: {type(exc).__name__}'
