"""Database connection policy for Supabase Postgres.

Everything the app needs to talk to Supabase lives here: URL normalization,
connection-mode detection (session pooler / transaction pooler / direct),
engine sizing for a free instance, and a bounded connect retry for the
"database is waking up" case (Supabase pauses idle free projects). SQLite
(local dev) bypasses all of it.

Secrets policy: the password lives only inside DATABASE_URL and is never
logged or echoed. Startup prints exactly one line, without credentials:

    database: postgres host=<host> port=<port> mode=<session|transaction|direct>

or, for the local dev fallback:

    database: sqlite (local dev)
"""

import logging
import os
import time

from sqlalchemy.engine import make_url

log = logging.getLogger('linuxdocs.db')

# Hosts treated as local (no forced TLS): plain local development.
LOCAL_HOSTS = ('localhost', '127.0.0.1', '::1')
# Supabase pooler hosts end with this; anything else on 5432 is a direct
# connection (db.<ref>.supabase.co or a self-hosted Postgres).
_POOLER_SUFFIX = '.pooler.supabase.com'


class DatabaseUrlError(ValueError):
    """DATABASE_URL could not be parsed. The URL text itself is never echoed
    in the error message — it contains the password."""


def normalize_database_url(raw: str | None) -> str | None:
    """Return a SQLAlchemy-ready URI, or ``raw`` unchanged for non-postgres.

    - ``postgres://`` / ``postgresql://`` / ``postgresql+psycopg2://`` all
      become the psycopg 3 dialect (``postgresql+psycopg://``),
    - non-localhost hosts gain ``sslmode=require`` (Supabase requires TLS and
      an existing sslmode is never overwritten),
    - a malformed URL raises :class:`DatabaseUrlError` with a fixed message.

    The returned string keeps the password (the engine needs it to connect),
    but it must only ever be *used*, never logged.
    """
    if not raw:
        return raw
    try:
        url = make_url(raw)
    except Exception:
        raise DatabaseUrlError(
            'DATABASE_URL is not a valid database URL (check .env / the '
            'provider dashboard). No secret material is shown here by design.')
    if not url.drivername.startswith('postgres'):
        return raw  # sqlite:// and anything else: dev fallback, untouched
    url = url.set(drivername='postgresql+psycopg')
    host = url.host or ''
    if host and host not in LOCAL_HOSTS and 'sslmode' not in url.query:
        url = url.update_query_dict({'sslmode': 'require'})
    return url.render_as_string(hide_password=False)


def is_postgres(conn_uri: str | None) -> bool:
    """True when the (already normalized) URI targets Postgres."""
    return bool(conn_uri) and conn_uri.startswith('postgresql')


def connection_mode(conn_uri: str) -> str:
    """Which Supabase connection mode the URL represents.

    - port 6543  → transaction pooler (PgBouncer transaction pooling)
    - *.pooler.supabase.com on any other port → session pooler (default)
    - anything else → direct connection

    ``DB_POOL_MODE`` (session|transaction|direct) wins when set; an unknown
    value is ignored so a typo cannot silently change connection behavior.
    """
    override = os.getenv('DB_POOL_MODE', '').strip().lower()
    if override in ('session', 'transaction', 'direct'):
        return override
    url = make_url(conn_uri)
    port = url.port or 5432
    host = url.host or ''
    if port == 6543:
        return 'transaction'
    if host.endswith(_POOLER_SUFFIX):
        return 'session'
    return 'direct'


def log_line(conn_uri: str | None) -> str:
    """The single credential-free startup line for the active database."""
    if not conn_uri or not is_postgres(conn_uri):
        return 'database: sqlite (local dev)'
    url = make_url(conn_uri)
    return (f'database: postgres host={url.host or ""} '
            f'port={url.port or 5432} mode={connection_mode(conn_uri)}')


def postgres_engine_options(conn_uri: str) -> dict:
    """SQLAlchemy Engine kwargs sized for a free Supabase instance.

    Free projects pause after inactivity and the pooler hosts have tight
    connection limits, so: tiny pool (1 worker x 4 threads on Render fits in
    3 + 2 overflow), pre_ping to survive idle kills, recycle before the 5
    minute pooler idle timeout, and a creator that adds the connect timeout
    plus a bounded retry/backoff for the waking-up case.
    """
    mode = connection_mode(conn_uri)
    return {
        'pool_pre_ping': True,
        'pool_size': 3,
        'max_overflow': 2,
        'pool_recycle': 300,
        'pool_timeout': 10,
        'creator': _make_connect(conn_uri, mode),
    }


def _make_connect(conn_uri: str, mode: str):
    """Build the psycopg 3 connect function the engine pool will call.

    The DSN is re-rendered without the ``+psycopg`` dialect tag (libpq URI
    format) plus a ``connect_timeout``, and in transaction mode prepared
    statements are disabled because PgBouncer in transaction pooling cannot
    support them. Each attempt retries a few times with backoff in case the
    database is paused or still waking; only the exception *type* reaches the
    log, never the message (which contains no credentials anyway but can name
    internal hosts).
    """
    # Deferred import keeps a sqlite-only environment psycopg-free.
    import psycopg

    dsn = make_url(conn_uri).set(drivername='postgresql') \
        .render_as_string(hide_password=False)
    timeout = _env_int('DB_CONNECT_TIMEOUT', 10)
    retries = max(1, _env_int('DB_CONNECT_RETRIES', 3))
    backoff = float(os.getenv('DB_CONNECT_BACKOFF', '0.5'))

    def connect():
        last: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                conn = psycopg.connect(dsn, connect_timeout=timeout)
                if mode == 'transaction':
                    conn.prepare_threshold = None
                return conn
            except Exception as exc:  # noqa: BLE001 - retried below
                last = exc
                if attempt < retries:
                    delay = backoff * (2 ** (attempt - 1))
                    log.info('database: connect retry %d/%d in %.1fs (%s)',
                             attempt, retries, delay, type(exc).__name__)
                    time.sleep(delay)
        log.error('database: connect failed after %d attempts (%s)',
                  retries, type(last).__name__)
        raise last  # type: ignore[misc]

    return connect


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default
