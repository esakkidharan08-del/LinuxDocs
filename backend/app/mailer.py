"""Password-reset email delivery.

Optional on purpose: if no email provider is configured the auth flow keeps
working in "dev mode" (the raw token is only logged server-side, never in
production logs). Two providers are supported out of the box:

* ``RESEND_API_KEY``   — HTTP API mode. Simplest on Render: no SMTP ports,
  one POST per email. Free tier is fine for a portfolio app.
* ``SMTP_HOST/PORT/USER/PASSWORD`` — classic SMTP for anyone (Gmail app
  password, Mailjet, their own MTA...). STARTTLS on 587, implicit SSL on 465.

Nothing here ever crashes the auth request: failures are reported back to the
caller as ``('failed', reason)`` so the endpoint can log and still answer 202.
"""
import json
import os
import smtplib
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr

from flask import current_app

from .security import _warn_security


def _provider() -> str:
    if os.getenv('RESEND_API_KEY'):
        return 'resend'
    if os.getenv('SMTP_HOST') and os.getenv('SMTP_USER') and os.getenv('SMTP_PASSWORD'):
        return 'smtp'
    return 'skipped'


def _from_address() -> str:
    raw = os.getenv('MAIL_FROM') or os.getenv('SMTP_USER') or 'onboarding@resend.dev'
    if '<' in raw:                      # already formatted: "LinuxDocs <me@host>"
        return raw
    return formataddr(('LinuxDocs', raw))


def is_email_configured() -> bool:
    return _provider() != 'skipped'


def reset_link(token: str) -> str:
    base = (os.getenv('FRONTEND_ORIGIN') or '').rstrip('/')
    return f'{base}/password-reset?token={token}'


def _bodies(username: str, link: str) -> tuple[str, str]:
    """(subject, html) — a plain-text twin lives alongside the HTML part."""
    subject = 'Reset your LinuxDocs password'
    html = f"""\
<div style="margin:0;padding:0;background:#05080a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Menlo,Consolas,'Courier New',monospace;">
    <p style="margin:0 0 18px;color:#2dd4a0;font-size:12px;letter-spacing:.35em;">LINUXDOCS://RESET</p>
    <div style="background:#0b1116;border:1px solid #1d2a2f;border-radius:12px;padding:28px;">
      <h1 style="margin:0 0 14px;color:#f8faf8;font-size:22px;font-weight:700;">
        Reset your password
      </h1>
      <p style="margin:0 0 18px;color:#9aa8a3;font-size:14px;line-height:1.6;">
        Hi <span style="color:#2dd4a0;font-weight:700;">{username}</span> — we received a request to
        reset the password for this account. This button gives you a one-time,
        single-use link that expires in <strong style="color:#f8faf8;">30 minutes</strong>.
      </p>
      <a href="{link}"
         style="display:inline-block;padding:13px 26px;border-radius:8px;background:#2dd4a0;
                color:#05080a;font-weight:700;font-size:14px;text-decoration:none;">
        Choose a new password
      </a>
      <p style="margin:22px 0 0;color:#5f6f6a;font-size:12px;line-height:1.6;">
        Not you? Ignore this email — the password stays unchanged and the link
        dies unused. The link also works once only.
      </p>
    </div>
    <p style="margin:18px 0 0;color:#5f6f6a;font-size:11px;line-height:1.6;">
      Copy-paste link if the button fails:<br>
      <span style="color:#7fd4b0;word-break:break-all;">{link}</span>
    </p>
  </div>
</div>"""
    return subject, html


def _text_part(username: str, link: str) -> str:
    return (
        f"Hi {username},\n\n"
        "We received a request to reset the password for your LinuxDocs account.\n"
        "This one-time link expires in 30 minutes:\n\n"
        f"  {link}\n\n"
        "If you didn't request this, ignore the email — your password stays "
        "unchanged.\n\n— LinuxDocs"
    )


def _send_resend(to_email: str, subject: str, html: str, text: str) -> None:
    payload = {
        'from': _from_address(),
        'to': [to_email],
        'subject': subject,
        'html': html,
        'text': text,
    }
    req = urllib.request.Request(
        'https://api.resend.com/emails',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f"Bearer {os.environ['RESEND_API_KEY']}",
        },
        method='POST')
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


def _send_smtp(to_email: str, subject: str, html: str, text: str) -> None:
    msg = EmailMessage()
    msg['From'] = _from_address()
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype='html')

    host = os.environ['SMTP_HOST']
    port = int(os.getenv('SMTP_PORT', '587'))
    user = os.environ['SMTP_USER']
    password = os.environ['SMTP_PASSWORD']

    if port == 465:                                  # implicit SSL
        server = smtplib.SMTP_SSL(host, port, timeout=15)
    else:                                            # STARTTLS (587 et al)
        server = smtplib.SMTP(host, port, timeout=15)
    try:
        if port != 465:
            server.starttls()
        server.login(user, password)
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass


def send_reset_email(to_email: str, username: str, token: str) -> tuple[str, str]:
    """Try to deliver the reset mail. Returns ('sent'|'skipped'|'failed', detail)."""
    provider = _provider()
    link = reset_link(token)
    subject, html = _bodies(username, link)
    text = _text_part(username, link)

    if provider == 'skipped':
        # Dev mode — the auth route itself decides whether it may log the token.
        return 'skipped', 'no RESEND_API_KEY or SMTP credentials configured'

    try:
        if provider == 'resend':
            _send_resend(to_email, subject, html, text)
        else:
            _send_smtp(to_email, subject, html, text)
    except Exception as exc:  # a dead provider must never 500 the auth flow
        current_app.logger.error('reset email failed (%s): %s', provider, str(exc)[:200])
        _warn_security('reset_email_failed', provider=provider, detail=str(exc)[:120])
        return 'failed', str(exc)[:160]

    _warn_security('reset_email_sent', provider=provider)
    return 'sent', f'delivered via {provider}'
