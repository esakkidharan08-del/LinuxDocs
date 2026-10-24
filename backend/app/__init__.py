import os
import sys
import base64
import hashlib
import logging
import time
from pathlib import Path
from flask import Flask, jsonify, request, g
from sqlalchemy import text as sa_text
from sqlalchemy.exc import OperationalError, DisconnectionError
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

def validate_env():
    required = ['SECRET_KEY', 'JWT_SECRET_KEY', 'DATABASE_URL', 'FRONTEND_ORIGIN']
    missing = [var for var in required if not os.getenv(var)]
    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        print("Copy .env.example to .env and fill in all values.", file=sys.stderr)
        sys.exit(1)

validate_env()

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()

# Flask-Migrate (Part 2): versioned schema migrations for user_progress.
# `migrations/` holds the hand-written chain (001_initial → 002_user_progress);
# `create_all()` below still covers fresh dev/test databases, but is skipped
# while an alembic CLI command runs (its argv contains "db") so it cannot
# race the upgrade.
from flask_migrate import Migrate  # noqa: E402

migrate = Migrate()


def _running_db_command() -> bool:
    return any(arg == 'db' for arg in sys.argv)

# ---- Tin-foil umbrella: backend-only logging of security events -------------

def _setup_logging(app):
    level = logging.DEBUG if app.debug else logging.INFO
    if not app.logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s [%(name)s] %(message)s'))
        app.logger.addHandler(handler)
    # Flask's app.logger inherits WARNING from the root logger, which would
    # swallow the credential-free startup line (INFO). Align it explicitly.
    app.logger.setLevel(level)
    for name in ('linuxdocs.security',):  # noqa: C901
        logger = logging.getLogger(name)
        if not logger.handlers:
            logger.addHandler(logging.StreamHandler())
            logger.setLevel(level)
        if not logger.propagate:
            logger.propagate = True
        _attach_security_log_file(logger, app)


def _attach_security_log_file(logger, app):
    """Persist the security audit trail to disk so attacks survive a restart.

    Rate-limit trips, lockouts, origin/host rejections and session revocations
    are only useful if they can be read *after* the incident, so they are
    mirrored to a rotating file next to the database.
    """
    target = os.getenv('SECURITY_LOG_FILE', '').strip()
    if target == 'off':
        return
    if target:
        log_path = Path(target)
    else:
        # Same directory the database lives in (backend/instance/), regardless
        # of how Flask resolves its instance_path inside a package.
        log_path = Path(__file__).resolve().parent.parent / 'instance' / 'security.log'
    if os.getenv('PYTEST_CURRENT_TEST') or app.config.get('TESTING'):
        return
    for existing in logger.handlers:
        if getattr(existing, 'baseFilename', None) == str(log_path.resolve()):
            return
    try:
        from logging.handlers import RotatingFileHandler
        from .security import env_int
        log_path.parent.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(
            log_path, maxBytes=env_int('SECURITY_LOG_MAX_BYTES', 5 * 1024 * 1024),
            backupCount=env_int('SECURITY_LOG_BACKUPS', 5), encoding='utf-8')
        handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s %(message)s'))
        handler.setLevel(level=logger.level or logging.INFO)
        logger.addHandler(handler)
    except OSError:                                      # pragma: no cover - read-only fs
        logger.warning('security log file unavailable at %s', log_path)


def _theme_script_hash():
    """SHA-256 (base64) of the inline theme script in index.html, for the CSP."""
    for candidate in (Path(__file__).resolve().parent.parent.parent / 'public' / 'index.html',
                      Path(__file__).resolve().parent.parent.parent / 'dist' / 'index.html'):
        try:
            html = candidate.read_text(encoding='utf-8')
        except OSError:
            continue
        start = html.find('<script>')
        end = html.find('</script>')
        if start != -1 and end != -1:
            script = html[start + len('<script>'):end].encode('utf-8')
            return base64.b64encode(hashlib.sha256(script).digest()).decode('ascii')
    return ''


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
    # DATABASE_URL normalization + Supabase engine policy (docs in app/database.py).
    # Malformed URLs abort startup with a fixed message that never echoes
    # the URL itself (it contains the password).
    from .database import (
        normalize_database_url, is_postgres, postgres_engine_options,
        connection_mode, log_line,
    )
    _uri = normalize_database_url(os.getenv('DATABASE_URL'))
    app.config['SQLALCHEMY_DATABASE_URI'] = _uri
    if is_postgres(_uri):
        # Pool sizing + connect retry live in the engine options; sqlite
        # keeps SQLAlchemy's own defaults so tests/dev behave exactly as before.
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = postgres_engine_options(_uri)
        app.config['DB_MODE'] = connection_mode(_uri)
    else:
        app.config['DB_MODE'] = 'sqlite'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 900))
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', 2592000))
    app.config['JWT_TOKEN_LOCATION'] = ['headers', 'cookies']
    _samesite = os.getenv('SESSION_COOKIE_SAMESITE', 'Strict').strip().capitalize()
    if _samesite not in ('Strict', 'Lax', 'None'):
        _samesite = 'Strict'
    _localhost = os.getenv('FRONTEND_ORIGIN', '').startswith(('http://localhost', 'http://127.0.0.1'))
    app.config['JWT_COOKIE_SECURE'] = True if _samesite == 'None' else not _localhost
    app.config['JWT_COOKIE_SAMESITE'] = _samesite
    app.config['JWT_COOKIE_CSRF_PROTECT'] = False
    app.config['FRONTEND_ORIGIN'] = os.getenv('FRONTEND_ORIGIN')
    app.config['ENV'] = 'production' if os.getenv('FLASK_ENV') == 'production' else 'development'
    app.config['TRUST_PROXY_HEADERS'] = os.getenv('TRUST_PROXY_HEADERS', '').lower() in ('1', 'true', 'yes')
    app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', str(1 * 1024 * 1024)))
    app.config['THEME_SCRIPT_HASH'] = _theme_script_hash()
    app.json.ensure_ascii = False  # serve unicode-safe JSON

    if app.config['TRUST_PROXY_HEADERS']:
        # Only trust proxies when explicitly configured (see security.py client_ip()).
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    from .security import (
        assign_request_id, add_security_headers, enforce_json_requests,
        enforce_global_rate_limit, enforce_host_allowlist, _warn_security,
    )

    @app.before_request
    def _request_id():
        assign_request_id()

    # Order matters: shed load before touching the body, then validate the
    # Host, then the payload itself.
    @app.before_request
    def _global_limit():
        return enforce_global_rate_limit()

    @app.before_request
    def _host_guard():
        return enforce_host_allowlist()

    @app.before_request
    def _content_type_guard():
        return enforce_json_requests()

    @app.after_request
    def _harden(response):
        add_security_headers(response)
        return response

    _setup_logging(app)
    app.logger.info(log_line(app.config['SQLALCHEMY_DATABASE_URI']))

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    frontend_origin = os.getenv('FRONTEND_ORIGIN')
    CORS(app,
         origins=[frontend_origin],
         supports_credentials=True,
         methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
         allow_headers=['Content-Type', 'Authorization', 'X-Request-ID'],
         max_age=600)

    from .models import User, Bookmark, UserNote, RecentlyViewed, Session, PasswordResetToken
    from .auth import auth_bp
    from .user import user_bp
    from .commands import commands_bp
    from .recovery import recovery_bp
    from .persistence import (
        configure_persistence, prime_backup, start_maintenance, register_cli,
    )

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(user_bp, url_prefix='/api/user')
    app.register_blueprint(commands_bp, url_prefix='/api')
    app.register_blueprint(recovery_bp, url_prefix='/api/auth')
    register_cli(app)

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok'})

    @app.route('/api/ready')
    def ready():
        """Readiness probe: one real round-trip to the database.

        Survives a paused or waking managed database (Supabase free projects
        sleep after ~7 idle days): failure is a clear 503 with a request id
        for correlation — never a stack trace, never credentials.
        """
        started = time.perf_counter()
        try:
            engine = app.extensions['sqlalchemy'].engines[None]
            with engine.connect() as conn:
                conn.execute(sa_text('SELECT 1'))
        except Exception:                                     # noqa: BLE001
            _warn_security('database_unreachable', path=request.path)
            return jsonify({
                'error': 'Database is not ready. It may be waking up — '
                         'please retry shortly.',
                'request_id': getattr(g, 'request_id', None),
            }), 503
        latency_ms = round((time.perf_counter() - started) * 1000)
        return jsonify({'status': 'ok', 'database': 'ready',
                        'latency_ms': latency_ms,
                        'mode': app.config.get('DB_MODE', 'unknown')}), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({'error': 'Request body too large'}), 413

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({'error': 'Too many requests. Please slow down.'}), 429

    @app.errorhandler(500)
    def server_error(e):
        # A paused or unreachable managed database is an availability state,
        # not an application crash: answer 503 with a clear, request-id'd
        # message instead of a generic 500 (and never a stack trace).
        # Flask hands the 500 handler an InternalServerError wrapper whose
        # .original_exception carries the real raised exception.
        from sqlalchemy.exc import DBAPIError
        real = getattr(e, 'original_exception', None) or e
        if isinstance(real, (OperationalError, DisconnectionError,
                            DBAPIError, ConnectionError, OSError)):
            _warn_security('database_unreachable', path=request.path)
            return jsonify({
                'error': 'Database is not ready. It may be waking up — '
                         'please retry shortly.',
                'request_id': getattr(g, 'request_id', None),
            }), 503
        _warn_security('server_error', path=request.path)
        return jsonify({'error': 'Internal server error'}), 500

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token'}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Authorization required'}), 401

    with app.app_context():
        # Verify/repair the database BEFORE the first connection touches it,
        # then create anything missing, snapshot it, and start maintenance.
        # Sqlite (dev/tests) keeps the create_all() fallback; a managed
        # Postgres like Supabase is owned by the alembic chain instead, so
        # create_all must never shadow migrations there (schema drift risk:
        # auto-created tables without alembic_version rows). While a
        # `flask db …` command runs (argv contains "db") or tests opt out with
        # SKIP_DB_CREATE_ALL=1, migrations own the table set too.
        from .database import is_postgres
        db_path = configure_persistence(app)
        migrate.init_app(app, db, directory=os.path.join(os.path.dirname(__file__), '..', 'migrations'))
        if _running_db_command() or os.getenv('SKIP_DB_CREATE_ALL') == '1':
            db_path = None  # migrations own the schema; nothing to snapshot
        elif is_postgres(app.config['SQLALCHEMY_DATABASE_URI']):
            db_path = None  # managed schema: `flask db upgrade`, never create_all
        else:
            db.create_all()
        if db_path:
            prime_backup(db_path)
            start_maintenance(app, db_path)

    return app
