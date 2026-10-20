"""Defense-in-depth helpers for the LinuxDocs API.

Implements (zero new dependencies):

* Sliding-window in-memory **rate limiting** (per-IP and per-account).
* **Account lockout** after repeated failed logins.
* **Security headers** (X-Frame-Options, X-Content-Type-Options, CSP, HSTS,
  Referrer-Policy, Permissions-Policy).
* **Cross-site request forgery (CSRF) defense** for cookie-authenticated
  endpoints: state-changing API requests that carry an ``Origin`` header must
  match the configured frontend origin.
* **Request IDs** and a `RATE_LIMIT` / security-event log used by blueprints.

All limits are configurable through environment variables and are disabled
automatically under ``TESTING`` unless ``RATE_LIMIT_ENABLED`` is explicitly
turned on (keeps the existing test-suite deterministic while staying active in
production).
"""

from __future__ import annotations

import functools
import hashlib
import logging
import os
import secrets
import threading
import time
from collections import defaultdict, deque

from flask import current_app, g, jsonify, request

log = logging.getLogger('linuxdocs.security')


def env_int(name: str, default: int) -> int:
    """Read an integer from the environment, falling back to a default."""
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default

# ---------------------------------------------------------------------------
# Sliding-window rate limiter
# ---------------------------------------------------------------------------

class RateLimiter:
    """Thread-safe sliding-window counter keyed by arbitrary scopes."""

    def __init__(self, max_keys: int = 100_000):
        self._lock = threading.Lock()
        self._counts: dict[str, deque] = defaultdict(deque)
        self._max_keys = max_keys

    def hit(self, key: str, limit: int, window: float) -> bool:
        """Record a hit; return True if still allowed within (limit, window)."""
        if limit <= 0:
            return True
        now = time.monotonic()
        with self._lock:
            queue = self._counts[key]
            cutoff = now - window
            while queue and queue[0] <= cutoff:
                queue.popleft()
            if len(queue) >= limit:
                return False
            queue.append(now)
            # Opportunistic memory hygiene
            if len(self._counts) > self._max_keys:
                for k in list(self._counts):
                    q = self._counts[k]
                    while q and q[0] <= cutoff:
                        q.popleft()
                    if not q:
                        del self._counts[k]
            return True

    def peek(self, key: str, window: float) -> int:
        """Count current hits (used for lockout state checks)."""
        now = time.monotonic()
        with self._lock:
            queue = self._counts.get(key, deque())
            while queue and queue[0] <= now - window:
                queue.popleft()
            return len(queue)

    def clear(self, key: str) -> None:
        with self._lock:
            self._counts.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._counts.clear()


limiter = RateLimiter()
lockout_store: dict[str, tuple[list[float], float]] = {}
_lockout_lock = threading.Lock()


def rate_limiter_enabled() -> bool:
    if os.getenv('RATE_LIMIT_ENABLED') is not None:
        return os.getenv('RATE_LIMIT_ENABLED').lower() in ('1', 'true', 'yes')
    # Enabled in production, disabled in tests unless forced on.
    app = current_app._get_current_object()
    return not app.config.get('TESTING', False)


def rate_limit(key: str, limit_func, limit_seconds: float):
    """Decorator: enforce limit=limit_func() hits per window for this request.

    The limit is resolved at request time from ``limit_func`` so environments
    can tune it without code changes. `{ip}` in the key is replaced with the
    caller's IP, so per-client limits are isolated per key.
    """
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if rate_limiter_enabled():
                scope_key = key.format(ip=client_ip())
                limit = max(0, int(limit_func()))
                if not limiter.hit(scope_key, limit, limit_seconds):
                    _warn_security('rate_limit', key=scope_key)
                    resp = jsonify({'error': 'Too many requests. Please slow down.'})
                    resp.headers['Retry-After'] = str(max(1, int(limit_seconds)))
                    return resp, 429
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_trusted_origin():
    """Reject state-changing requests whose Origin is external.

    Browser-mandated ``Origin`` header is present on cross-site requests and
    cannot be forged by scripts. Requests without Origin (curl, server-side
    proxies, same-origin fetches in some browsers) are accepted; SameSite=Strict
    cookies and the login rate-limits cover those paths.
    """
    origin = request.headers.get('Origin')
    if not origin:
        return
    allowed = _allowed_origins()
    if origin in allowed:
        return
    # Same-origin navigations also carry an Origin of the form scheme://host.
    if origin == f"{request.scheme}://{request.host}":
        return
    _warn_security('origin_mismatch', origin=origin)
    return jsonify({'error': 'Cross-origin request rejected'}), 403


def _allowed_origins() -> set[str]:
    origins = {current_app.config.get('FRONTEND_ORIGIN', '')}
    extra = os.getenv('ALLOWED_ORIGINS', '')
    origins.update(o.strip() for o in extra.split(',') if o.strip())
    origins.discard('')
    return origins


# ---------------------------------------------------------------------------
# Account lockout
# ---------------------------------------------------------------------------

def register_failed_login(account_key: str, attempts_window: float,
                          lockout_seconds: float, max_attempts: int) -> bool:
    """Record a failed login. Returns True if the account is now locked out."""
    now = time.monotonic()
    with _lockout_lock:
        timestamps, _ = lockout_store.get(account_key, ([], 0.0))
        timestamps = [t for t in timestamps if now - t < attempts_window]
        if len(timestamps) >= max_attempts:
            # Already locked
            lockout_store[account_key] = (timestamps, now + lockout_seconds)
            return True
        timestamps.append(now)
        lockout_store[account_key] = (timestamps, 0.0)
        if len(timestamps) >= max_attempts:
            lockout_store[account_key] = (timestamps, now + lockout_seconds)
            _warn_security('account_locked', account=account_key)
            return True
        return False


def is_account_locked(account_key: str) -> bool:
    now = time.monotonic()
    with _lockout_lock:
        timestamps, locked_until = lockout_store.get(account_key, ([], 0.0))
        if locked_until and now < locked_until:
            return True
        if locked_until and now >= locked_until:
            lockout_store[account_key] = ([t for t in timestamps if now - t < 3600], 0.0)
        return False


def clear_login_failures(account_key: str) -> None:
    with _lockout_lock:
        lockout_store.pop(account_key, None)


# ---------------------------------------------------------------------------
# Request hygiene
# ---------------------------------------------------------------------------

def client_ip() -> str:
    """Best-effort client IP with proxy awareness.

    Only trusts ``X-Forwarded-For`` when ``TRUST_PROXY_HEADERS`` is set, so a
    random client cannot spoof a rate-limit key in front of the app.
    """
    if current_app.config.get('TRUST_PROXY_HEADERS'):
        fwd = request.headers.get('X-Forwarded-For', '')
        if fwd:
            return fwd.split(',')[0].strip()[:45]
    return request.remote_addr or 'unknown'


def enforce_json_requests():
    """Reject JSON-shaped requests that forget the content type, bodies that
    exceed the configured size limit (also guarded by MAX_CONTENT_LENGTH),
    and payloads that are not a JSON *object*.

    The last part matters: endpoints do ``request.get_json(silent=True) or {}``
    and then call ``.get()``. A top-level array such as ``[1,2,3]`` is truthy,
    so ``.get()`` raised ``AttributeError`` -> an unauthenticated 500 on every
    endpoint. Malformed JSON is now an explicit 400 instead of being silently
    treated as an empty body.
    """
    if request.method in ('GET', 'HEAD', 'OPTIONS'):
        return None
    ct = (request.content_type or '').split(';')[0].strip()
    if not ct:
        return None  # empty body allowed (e.g. logout)
    if ct != 'application/json':
        _warn_security('bad_content_type', content_type=ct)
        return jsonify({'error': 'Content-Type must be application/json'}), 415

    body = request.get_data(cache=True)
    if not body:
        return None
    payload = request.get_json(silent=True)
    if payload is None:
        _warn_security('malformed_json', path=request.path)
        return jsonify({'error': 'Malformed JSON body'}), 400
    if not isinstance(payload, dict):
        _warn_security('non_object_json', path=request.path, type=type(payload).__name__)
        return jsonify({'error': 'JSON body must be an object'}), 400
    return None


def enforce_global_rate_limit():
    """Per-IP cap on *all* requests, not just the sensitive endpoints.

    Covers everything a flood could target (health, command reads, 404s) so a
    single client cannot exhaust the process, and shields the per-endpoint
    limits from having to absorb the whole attack.
    """
    if not rate_limiter_enabled():
        return None
    limit = env_int('GLOBAL_RATE_LIMIT', 600)
    if limit <= 0:
        return None
    window = max(1, env_int('GLOBAL_RATE_WINDOW_SECONDS', 60))
    key = f'global:ip:{client_ip()}'
    if not limiter.hit(key, limit, window):
        _warn_security('global_rate_limit', ip=client_ip(), path=request.path)
        resp = jsonify({'error': 'Too many requests. Please slow down.'})
        resp.headers['Retry-After'] = str(window)
        return resp, 429
    return None


def enforce_host_allowlist():
    """Reject requests whose ``Host`` header is not one we actually serve.

    Guards against Host-header poisoning (password-reset links, cache
    poisoning, absolute-URL confusion) by an attacker who reaches the API
    with a forged Host. ``ALLOWED_HOSTS=*`` disables the check for unusual
    topologies; extra names are comma-separated.
    """
    if not _env_bool('HOST_HEADER_CHECK', True):
        return None
    host = request.host or ''
    hostname = _hostname_of(host)
    if not hostname:
        return None
    allowed = _allowed_hosts()
    if '*' in allowed or hostname.lower() in allowed:
        return None
    _warn_security('host_rejected', host=host, path=request.path)
    return jsonify({'error': 'Invalid Host header'}), 400


def _hostname_of(host: str) -> str:
    """Hostname portion of a ``host`` / ``host:port`` / ``[v6]:port`` value."""
    try:
        from urllib.parse import urlsplit
        return (urlsplit('//' + host).hostname or '').lower()
    except ValueError:
        return ''


def _allowed_hosts() -> set[str]:
    hosts = {'localhost', '127.0.0.1', '::1'}
    for raw in (current_app.config.get('FRONTEND_ORIGIN', ''),
                os.getenv('ALLOWED_HOSTS', '')):
        if raw.strip() == '*':
            return {'*'}
        for chunk in raw.split(','):
            chunk = chunk.strip()
            if not chunk:
                continue
            try:
                from urllib.parse import urlsplit
                parsed = urlsplit(chunk if '://' in chunk else '//' + chunk)
                hosts.add((parsed.hostname or '').lower())
            except ValueError:
                continue
    hosts.discard('')
    return hosts


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes', 'on')


def assign_request_id():
    """Attach/generate a request id for correlation and audit logs."""
    request_id = request.headers.get('X-Request-ID') or secrets.token_hex(8)
    g.request_id = request_id
    return request_id


def add_security_headers(response):
    """Emit hardening headers on every API response."""
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'DENY')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('Permissions-Policy',
                                'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    if getattr(g, 'request_id', None):
        response.headers.setdefault('X-Request-ID', g.request_id)

    app = current_app._get_current_object()
    prod_exposure = app.config.get('ENV') == 'production' or os.getenv('FLASK_ENV') == 'production'

    if prod_exposure:
        response.headers.setdefault('Strict-Transport-Security',
                                    'max-age=31536000; includeSubDomains')
        response.headers.setdefault(
            'Content-Security-Policy',
            _build_csp(app)
        )
    return response


def _build_csp(app) -> str:
    """Content-Security-Policy for the SPA.

    Loads Google Fonts, allows frame-ancestors 'none', and pins scripts to the
    inline theme script hash (computed at boot). ``CSP_EXTRA_CONNECT_SRC`` can
    widen connect-src for deployments where the API lives on another origin.
    """
    extra_connect = os.getenv('CSP_EXTRA_CONNECT_SRC', '').strip()
    connect = "'self'" + (f' {extra_connect}' if extra_connect else '')
    script_hash = app.config.get('THEME_SCRIPT_HASH', '')
    script_src = "'self'"
    if script_hash:
        script_src += f" 'sha256-{script_hash}'"
    return (
        "default-src 'self'; "
        f"script-src {script_src}; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        f"connect-src {connect}; "
        "object-src 'none'; base-uri 'self'; form-action 'self'; "
        "frame-ancestors 'none'; upgrade-insecure-requests"
    )


# ---------------------------------------------------------------------------
# Security audit log
# ---------------------------------------------------------------------------

def _warn_security(event: str, **fields) -> None:
    log.info('SEC-EVENT %s request_id=%s %s',
             event.upper(), getattr(g, 'request_id', '-'),
             ' '.join(f'{k}={v!r}' for k, v in fields.items()))


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def generate_opaque_token(nbytes: int = 48) -> str:
    """CSPRNG opaque bearer token (url-safe)."""
    return secrets.token_urlsafe(nbytes)