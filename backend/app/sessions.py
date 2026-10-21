"""Server-side session management for the LinuxDocs API.

Replaces stateless JWT refresh tokens with **opaque, ratable, rotating
sessions** so users can be *remembered* for long periods while an admin (or
the user) can always revoke access.

* Refresh cookies carry an opaque random token; the DB stores only the
  SHA-256 hash.
* Every successful refresh **rotates** the token (sliding expiration for
  remember-me sessions).
* Reusing a rotated-out token within a short grace window is tolerated (for
  parallel requests); reuse after the grace window is treated as token theft
  and revokes **all** of the user's sessions.
"""

from __future__ import annotations

import os
from datetime import timedelta

from flask import current_app, make_response, jsonify, request
from sqlalchemy import update as sa_update

from . import db
from .models import Session, utcnow, ensure_tz
from .security import (
    generate_opaque_token, sha256_hex, client_ip, _warn_security, env_int,
)

REFRESH_COOKIE = 'refresh_token_cookie'
# How long a rotated token may still be presented without being theft.
TOKEN_REUSE_GRACE_SECONDS = 45


def _ttl(remember: bool) -> timedelta:
    if remember:
        days = int(os.getenv('SESSION_REMEMBER_TTL_DAYS', '365'))
        return timedelta(days=max(1, days))
    hours = int(os.getenv('SESSION_TTL_HOURS', '24'))
    return timedelta(hours=max(1, hours))


def _same_site() -> str:
    """SameSite policy for the refresh cookie.

    Defaults to ``Strict`` (CSRF-hardened). Deployments that serve the SPA and
    API from genuinely different sites can set ``SESSION_COOKIE_SAMESITE=Lax``
    (or ``None`` for true cross-site — which forces ``Secure`` per browser
    rules). Invalid values fall back to ``Strict``.
    """
    value = os.getenv('SESSION_COOKIE_SAMESITE', 'Strict').strip().capitalize()
    return value if value in ('Strict', 'Lax', 'None') else 'Strict'


def _secure_cookie() -> bool:
    # SameSite=None is only honoured by browsers on Secure cookies.
    if _same_site() == 'None':
        return True
    return not (current_app.config.get('FRONTEND_ORIGIN', '').startswith('http://localhost')
                or current_app.config.get('FRONTEND_ORIGIN', '').startswith('http://127.0.0.1'))


def create_session(user_id: int, *, remember: bool, request_context=True) -> str:
    """Create a session, return the raw refresh token. The caller must commit."""
    token = generate_opaque_token()
    expires = utcnow() + _ttl(remember)
    kwargs = {}
    if request_context:
        kwargs = {'ip_address': client_ip(), 'user_agent': (request.user_agent.string or '')[:512]}
    _enforce_session_cap(user_id)
    db.session.add(Session(
        user_id=user_id,
        token_hash=sha256_hex(token),
        remember=remember,
        expires_at=expires,
        **kwargs,
    ))
    return token


def _enforce_session_cap(user_id: int, keep: int | None = None) -> None:
    """Evict the oldest *signable* sessions beyond ``MAX_SESSIONS_PER_USER``.

    Stops a caller from bloating the sessions table with unlimited logins
    (storage exhaustion) while still leaving plenty of room for real devices.
    Rotated rows are not counted: they are kept only for reuse/theft detection.
    """
    cap = env_int('MAX_SESSIONS_PER_USER', 25) if keep is None else keep
    if cap <= 0:
        return
    active = (Session.query
              .filter_by(user_id=user_id, revoked=False)
              .filter(Session.rotated_at.is_(None))
              .order_by(Session.created_at.asc(), Session.id.asc())
              .all())
    excess = len(active) - cap + 1          # one more is about to be added
    if excess <= 0:
        return
    for stale in active[:excess]:
        stale.revoked = True
        _warn_security('session_cap_evicted', user_id=user_id, session_id=stale.id)


def verify_session_token(raw_token: str):
    """Return (session, fresh) for a raw token, or None when invalid.

    ``fresh`` is False when the token was previously rotated but presented
    within the grace window (parallel-refresh tolerance).
    """
    if not raw_token:
        return None
    session = Session.query.filter_by(token_hash=sha256_hex(raw_token)).first()
    if session is None or session.revoked or session.is_expired():
        return None

    now = utcnow()
    if session.rotated_at is not None:
        rotated = ensure_tz(session.rotated_at)
        if (now - rotated).total_seconds() <= TOKEN_REUSE_GRACE_SECONDS:
            _touch(session)
            return session, False  # tolerated parallel reuse — no re-rotation
        _warn_security('token_reuse_theft', session_id=session.id, user_id=session.user_id)
        revoke_user_sessions(session.user_id)
        db.session.commit()
        return None
    return session, True


def rotate_session(session: Session):
    """Rotate the session token (sliding expiry), return (raw_token, replacement)."""
    token = generate_opaque_token()
    now = utcnow()
    replacement = Session(
        user_id=session.user_id,
        token_hash=sha256_hex(token),
        remember=session.remember,
        expires_at=now + _ttl(session.remember),
        ip_address=session.ip_address,
        user_agent=session.user_agent,
    )
    session.rotated_at = now
    db.session.add(replacement)
    db.session.flush()
    session.replaced_by_id = replacement.id
    db.session.commit()
    return token, replacement


def _touch(session: Session) -> None:
    session.last_seen_at = utcnow()
    db.session.commit()


def revoke_session(session: Session) -> None:
    session.revoked = True
    db.session.commit()


def revoke_user_sessions(user_id: int) -> int:
    """Revoke every session for a user; return the number revoked."""
    sessions = Session.query.filter_by(user_id=user_id, revoked=False).all()
    for s in sessions:
        s.revoked = True
    return len(sessions)


def prune_expired_sessions(max_delete: int = 500) -> int:
    """Best-effort cleanup of rows that can never authenticate again.

    Removes sessions past their TTL plus rotated-out sessions older than
    ``ROTATED_SESSION_RETENTION_HOURS``. Rotated rows are deliberately kept
    for a while: they are what lets us spot a stolen refresh token being
    replayed after its grace window and kill every session on the account.
    """
    now = utcnow()
    retention_hours = env_int('ROTATED_SESSION_RETENTION_HOURS', 168)
    horizon = now - timedelta(hours=max(1, retention_hours))

    rows = (Session.query
            .filter((Session.expires_at < now)
                    | ((Session.rotated_at.isnot(None))
                       & (Session.rotated_at < horizon)))
            .limit(max_delete)
            .all())
    for row in rows:
        db.session.delete(row)
    db.session.commit()
    return len(rows)


def set_refresh_cookie(response, raw_token: str, remember: bool) -> None:
    """Set the HttpOnly refresh cookie (SameSite configurable, default Strict)."""
    max_age = int(_ttl(remember).total_seconds())
    response.set_cookie(
        REFRESH_COOKIE,
        raw_token,
        max_age=max_age if remember else None,   # session cookie unless "remember me"
        httponly=True,
        secure=_secure_cookie(),
        samesite=_same_site(),
        path='/',
    )


def clear_refresh_cookie(response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path='/', domain=None)


def get_refresh_token_from_request() -> str:
    """Raw refresh token from the cookie (never from URLs/query)."""
    return request.cookies.get(REFRESH_COOKIE, '') or ''


# ---------------------------------------------------------------------------
# Password reset tokens (opaque + hashed)
# ---------------------------------------------------------------------------

def invalidate_outstanding_reset_tokens(user_id: int) -> int:
    """Delete unused reset tokens for a user — only the newest email counts.

    Used (already-clicked) rows stay for audit. Returns the number removed.
    """
    from .models import PasswordResetToken
    deleted = (db.session.query(PasswordResetToken)
               .filter(PasswordResetToken.user_id == user_id,
                       PasswordResetToken.used_at.is_(None))
               .delete(synchronize_session=False))
    return deleted


def create_reset_token(user_id: int) -> str:
    """Create a single-use hashed reset token; caller must commit."""
    from .models import PasswordResetToken
    invalidate_outstanding_reset_tokens(user_id)
    token = generate_opaque_token(40)
    ttl = timedelta(minutes=max(1, env_int('RESET_TOKEN_TTL_MINUTES', 30)))
    db.session.add(PasswordResetToken(
        user_id=user_id,
        token_hash=sha256_hex(token),
        expires_at=utcnow() + ttl,
    ))
    return token


def consume_reset_token(raw_token: str):
    """Atomically validate + claim a reset token; return the owning user or None.

    The claim is a single conditional UPDATE: ``used_at`` is only ever set when
    it is still NULL, so two concurrent callers can never both succeed — one
    UPDATE matches (rowcount 1), the other misses (rowcount 0) regardless of
    interleaving. Expiry is checked in Python with timezone-safe helpers to
    stay identical across SQLite and Postgres.
    """
    from .models import PasswordResetToken
    if not raw_token:
        return None
    token_hash = sha256_hex(raw_token)
    record = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
    if record is None or record.used_at is not None or record.is_expired():
        db.session.commit()          # release the read transaction cleanly
        return None
    result = db.session.execute(
        sa_update(PasswordResetToken)
        .where(PasswordResetToken.id == record.id,
               PasswordResetToken.used_at.is_(None))
        .values(used_at=utcnow())
        .execution_options(synchronize_session=False))
    claimed = result.rowcount == 1
    db.session.commit()
    if not claimed:
        return None
    db.session.refresh(record)
    return record.user


def make_api_response(payload, status: int):
    return make_response(jsonify(payload), status)