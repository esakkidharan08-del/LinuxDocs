"""Regression tests for the hardening pass.

Covers the attack surfaces that were closed (over-long bcrypt passwords,
non-object JSON bodies, forged Host headers, request flooding, session-table
bloat) and the durability guarantees behind "users are remembered forever"
(PRAGMAs, verified backups, corruption auto-restore, restart survival).
"""

import sqlite3
import time
from pathlib import Path

import pytest

from app import create_app, db
from app.models import User
from app.persistence import (
    check_and_repair, install_sqlite_pragmas, list_backups, take_backup,
    verify_database,
)
from app.sessions import create_session, prune_expired_sessions
from app import sessions as session_svc

from sqlalchemy import text

# 102-byte password: passes the 10..128 character policy but is over bcrypt's
# 72-byte block. Before the fix this crashed the register/login endpoints with
# an unhandled ValueError (an unauthenticated 500).
OVERLONG_PASSWORD = 'Aa1!' + 'x' * 98


def _seed_env(monkeypatch, db_file: Path):
    monkeypatch.setenv('SECRET_KEY', 'test-secret-key-for-testing-only')
    monkeypatch.setenv('JWT_SECRET_KEY', 'test-jwt-secret-key-for-testing-only')
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{db_file.as_posix()}')
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:5173')
    monkeypatch.setenv('JWT_ACCESS_TOKEN_EXPIRES', '900')
    monkeypatch.setenv('JWT_REFRESH_TOKEN_EXPIRES', '2592000')


def _build_app():
    from app.security import limiter, lockout_store
    limiter.reset()
    lockout_store.clear()
    application = create_app()
    application.config['TESTING'] = True
    return application


@pytest.fixture
def file_db(tmp_path, monkeypatch):
    """A file-backed SQLite database + isolated rate-limit state."""
    db_file = tmp_path / 'app.db'
    _seed_env(monkeypatch, db_file)
    return db_file


@pytest.fixture
def file_app(file_db):
    app = _build_app()
    with app.app_context():
        db.create_all()
        yield app, file_db
        db.session.remove()
        db.drop_all()


# ---------------------------------------------------------------------------
# 1. bcrypt's 72-byte ceiling (previously an unauthenticated 500)
# ---------------------------------------------------------------------------

def test_register_with_overlong_password_is_rejected_not_crashed(file_app):
    app, _ = file_app
    client = app.test_client(use_cookies=False)
    resp = client.post('/api/auth/register', json={
        'username': 'longpass', 'email': 'longpass@example.com',
        'password': OVERLONG_PASSWORD, 'confirm_password': OVERLONG_PASSWORD})
    assert resp.status_code == 400
    assert 'password' in resp.get_json()['errors']
    assert resp.status_code != 500


def test_login_with_overlong_password_is_rejected_not_crashed(file_app):
    app, _ = file_app
    client = app.test_client(use_cookies=False)
    client.post('/api/auth/register', json={
        'username': 'normal', 'email': 'normal@example.com',
        'password': 'NormalPass123!', 'confirm_password': 'NormalPass123!'})

    resp = client.post('/api/auth/login', json={
        'email': 'normal@example.com', 'password': OVERLONG_PASSWORD})
    assert resp.status_code == 401          # wrong password, not a 500
    assert 'errors' in resp.get_json()


def test_set_password_never_raises_on_long_input(file_app):
    app, _ = file_app
    with app.app_context():
        user = User(username='made', email='made@example.com')
        user.set_password(OVERLONG_PASSWORD)          # must not raise ValueError
        db.session.add(user)
        db.session.commit()


def test_check_password_rejects_overlong_input_without_raising(file_app):
    app, _ = file_app
    with app.app_context():
        user = User(username='chk', email='chk@example.com')
        user.set_password('NormalPass123!')
        assert user.check_password('NormalPass123!') is True
        assert user.check_password(OVERLONG_PASSWORD) is False   # no exception
        assert user.check_password('') is False


def test_change_password_rejects_overlong_new_password(file_app):
    app, _ = file_app
    client = app.test_client(use_cookies=False)
    reg = client.post('/api/auth/register', json={
        'username': 'changer', 'email': 'changer@example.com',
        'password': 'NormalPass123!', 'confirm_password': 'NormalPass123!'})
    token = reg.get_json()['access_token']

    resp = client.post('/api/user/change-password', headers={
        'Authorization': f'Bearer {token}',
        'Origin': 'http://localhost:5173'}, json={
        'current_password': 'NormalPass123!',
        'new_password': OVERLONG_PASSWORD,
        'confirm_password': OVERLONG_PASSWORD})
    assert resp.status_code == 400
    assert 'new_password' in resp.get_json()['errors']


# ---------------------------------------------------------------------------
# 2. JSON payload guards (top-level array used to be an unhandled 500)
# ---------------------------------------------------------------------------

def test_top_level_json_array_rejected(file_app):
    app, _ = file_app
    resp = app.test_client(use_cookies=False).post('/api/auth/login', json=[1, 2, 3])
    assert resp.status_code == 400
    assert 'object' in resp.get_json()['error'].lower()


def test_malformed_json_rejected(file_app):
    app, _ = file_app
    resp = app.test_client(use_cookies=False).post(
        '/api/auth/login', data='{not json', content_type='application/json')
    assert resp.status_code == 400
    assert 'malformed' in resp.get_json()['error'].lower()


def test_json_string_body_rejected(file_app):
    app, _ = file_app
    resp = app.test_client(use_cookies=False).post(
        '/api/auth/login', json='just-a-string')
    assert resp.status_code == 400


def test_empty_body_still_allowed_for_logout(file_app):
    app, _ = file_app
    resp = app.test_client(use_cookies=False).post('/api/auth/logout')
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 3. Host-header poisoning
# ---------------------------------------------------------------------------

def test_forged_host_header_rejected(file_app):
    app, _ = file_app
    resp = app.test_client(use_cookies=False).get(
        '/api/health', base_url='http://evil.example.com')
    assert resp.status_code == 400
    assert 'host' in resp.get_json()['error'].lower()


def test_forged_host_header_via_header_dict_rejected(file_app):
    app, _ = file_app
    resp = app.test_client(use_cookies=False).get(
        '/api/health', headers={'Host': 'attacker.example.net'})
    assert resp.status_code == 400


def test_localhost_host_allowed_on_any_port(file_app):
    app, _ = file_app
    client = app.test_client(use_cookies=False)
    assert client.get('/api/health').status_code == 200
    assert client.get('/api/health',
                      headers={'Host': 'localhost:5174'}).status_code == 200
    assert client.get('/api/health',
                      headers={'Host': '127.0.0.1:5000'}).status_code == 200


def test_host_check_can_be_disabled(file_app, monkeypatch):
    app, _ = file_app
    monkeypatch.setenv('HOST_HEADER_CHECK', '0')
    resp = app.test_client(use_cookies=False).get(
        '/api/health', base_url='http://anything.example.org')
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 4. Global request flood protection
# ---------------------------------------------------------------------------

def test_global_rate_limit_returns_429_with_retry_after(file_app, monkeypatch):
    app, _ = file_app
    monkeypatch.setenv('RATE_LIMIT_ENABLED', '1')
    monkeypatch.setenv('GLOBAL_RATE_LIMIT', '5')

    from app.security import limiter
    limiter.reset()

    client = app.test_client(use_cookies=False)
    codes = [client.get('/api/health').status_code for _ in range(8)]
    assert 429 in codes
    assert codes[:5] == [200] * 5

    blocked = next(r for r in (client.get('/api/health') for _ in range(1))
                   if r.status_code == 429)
    assert blocked.headers.get('Retry-After')
    assert int(blocked.headers['Retry-After']) >= 1


def test_global_rate_limit_off_by_default_in_testing(file_app):
    app, _ = file_app
    client = app.test_client(use_cookies=False)
    assert all(client.get('/api/health').status_code == 200 for _ in range(30))


def test_per_endpoint_rate_limit_sets_retry_after(file_app, monkeypatch):
    app, _ = file_app
    monkeypatch.setenv('RATE_LIMIT_ENABLED', '1')
    monkeypatch.setenv('LOGIN_RATE_LIMIT', '2')

    from app.security import limiter
    limiter.reset()

    client = app.test_client(use_cookies=False)
    payload = {'email': 'nobody@example.com', 'password': 'WrongPass123!'}
    client.post('/api/auth/login', json=payload)
    client.post('/api/auth/login', json=payload)
    blocked = client.post('/api/auth/login', json=payload)
    assert blocked.status_code == 429
    assert int(blocked.headers['Retry-After']) >= 1


# ---------------------------------------------------------------------------
# 5. Durable SQLite configuration
# ---------------------------------------------------------------------------

def test_file_app_gets_durability_pragmas(file_app):
    app, _ = file_app
    with app.app_context():
        assert db.session.execute(text('PRAGMA foreign_keys')).scalar() == 1
        mode = db.session.execute(text('PRAGMA journal_mode')).scalar()
        assert mode == 'wal'
        busy = db.session.execute(text('PRAGMA busy_timeout')).scalar()
        assert busy >= 1000
        sync = db.session.execute(text('PRAGMA synchronous')).scalar()
        assert sync == 2            # FULL: committed rows survive a power cut


def test_in_memory_database_skips_pragma_install(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///:memory:')
    monkeypatch.setenv('SECRET_KEY', 'test-secret-key-for-testing-only')
    monkeypatch.setenv('JWT_SECRET_KEY', 'test-jwt-secret-key-for-testing-only')
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:5173')
    app = _build_app()
    with app.app_context():
        assert install_sqlite_pragmas(db.engine) is False


def test_foreign_keys_cascade_at_sqlite_level(file_app):
    """SQLite ships with FKs off, so cascade deletes silently left orphans."""
    app, _ = file_app
    with app.app_context():
        user = User(username='cascade', email='cascade@example.com')
        user.set_password('CascadePass123!')
        db.session.add(user)
        db.session.flush()
        user_id = user.id
        db.session.execute(
            text("INSERT INTO bookmarks (user_id, command_slug, created_at) "
                 "VALUES (:u, 'ls', CURRENT_TIMESTAMP)"), {'u': user_id})
        db.session.commit()

        assert db.session.execute(text('PRAGMA foreign_keys')).scalar() == 1
        db.session.execute(text('DELETE FROM users WHERE id = :u'), {'u': user_id})
        db.session.commit()

        remaining = db.session.execute(
            text('SELECT COUNT(*) FROM bookmarks WHERE user_id = :u'),
            {'u': user_id}).scalar()
        assert remaining == 0


# ---------------------------------------------------------------------------
# 6. Backups: verified, rotated, and able to repair a corrupt database
# ---------------------------------------------------------------------------

def _seeded_database(path: Path, username: str = 'alice') -> None:
    conn = sqlite3.connect(str(path))
    try:
        conn.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)')
        conn.execute('INSERT INTO users (username) VALUES (?)', (username,))
        conn.commit()
    finally:
        conn.close()


def _read_usernames(path: Path) -> list[str]:
    conn = sqlite3.connect(str(path))
    try:
        return [row[0] for row in conn.execute('SELECT username FROM users')]
    finally:
        conn.close()


def test_take_backup_creates_a_verified_snapshot(tmp_path):
    db_file = tmp_path / 'app.db'
    _seeded_database(db_file, 'alice')

    out = take_backup(db_file, reason='unit')
    assert out is not None and out.exists()
    assert verify_database(out)
    assert _read_usernames(out) == ['alice']
    assert not list(tmp_path.glob('**/*.partial'))       # temp files cleaned up
    assert list_backups(db_file)                         # discovered again


def test_backups_are_rotated(tmp_path, monkeypatch):
    monkeypatch.setenv('BACKUP_KEEP', '2')
    db_file = tmp_path / 'app.db'
    _seeded_database(db_file)

    for i in range(4):
        assert take_backup(db_file, reason=f'run{i}') is not None
        time.sleep(0.01)

    assert len(list_backups(db_file)) == 2


def test_corrupt_database_is_auto_restored(tmp_path):
    db_file = tmp_path / 'app.db'
    _seeded_database(db_file, 'alice')
    assert take_backup(db_file, reason='good') is not None

    for suffix in ('', '-wal', '-shm'):
        Path(str(db_file) + suffix).unlink(missing_ok=True)
    db_file.write_bytes(b'\x00' * 4096)                  # destroy the file
    assert verify_database(db_file) is False

    assert check_and_repair(db_file) == 'restored'
    assert verify_database(db_file)
    assert _read_usernames(db_file) == ['alice']


def test_corrupt_database_without_backup_refuses_to_start(tmp_path):
    db_file = tmp_path / 'app.db'
    _seeded_database(db_file)
    for suffix in ('', '-wal', '-shm'):
        Path(str(db_file) + suffix).unlink(missing_ok=True)
    db_file.write_bytes(b'\x00' * 4096)

    with pytest.raises(RuntimeError):
        check_and_repair(db_file)


def test_intact_database_reports_ok(tmp_path):
    db_file = tmp_path / 'app.db'
    _seeded_database(db_file)
    assert check_and_repair(db_file) == 'ok'
    assert check_and_repair(tmp_path / 'never-created.db') == 'missing'


def test_auto_restore_can_be_disabled(tmp_path, monkeypatch):
    monkeypatch.setenv('DB_AUTO_RESTORE', '0')
    db_file = tmp_path / 'app.db'
    _seeded_database(db_file)
    db_file.write_bytes(b'\x00' * 4096)
    with pytest.raises(RuntimeError):
        check_and_repair(db_file)


# ---------------------------------------------------------------------------
# 7. "Remembered forever": users survive a full application restart
# ---------------------------------------------------------------------------

def test_users_survive_application_restart(file_db):
    app_one = _build_app()
    with app_one.app_context():
        db.create_all()
        client = app_one.test_client(use_cookies=False)
        resp = client.post('/api/auth/register', json={
            'username': 'keeper', 'email': 'keeper@example.com',
            'password': 'Quilt7-Morning!', 'confirm_password': 'Quilt7-Morning!'})
        assert resp.status_code == 201

    # Brand new app object == a process restart against the same file.
    app_two = _build_app()
    with app_two.app_context():
        db.create_all()
        client = app_two.test_client(use_cookies=False)
        resp = client.post('/api/auth/login', json={
            'email': 'keeper@example.com', 'password': 'Quilt7-Morning!'})
        assert resp.status_code == 200
        assert User.query.filter_by(email='keeper@example.com').one().username == 'keeper'


def test_restart_after_corruption_still_finds_the_user(file_db):
    app_one = _build_app()
    with app_one.app_context():
        db.create_all()
        resp = app_one.test_client(use_cookies=False).post('/api/auth/register', json={
            'username': 'survivor', 'email': 'survivor@example.com',
            'password': 'Quilt7-Morning!', 'confirm_password': 'Quilt7-Morning!'})
        assert resp.status_code == 201
        # Release the file handle (Windows refuses to unlink a held file).
        db.session.remove()
        db.engine.dispose()

    # A restart normally snapshots the database first (BACKUP_ON_STARTUP).
    assert take_backup(file_db, reason='pre-crash') is not None

    for suffix in ('', '-wal', '-shm'):
        Path(str(file_db) + suffix).unlink(missing_ok=True)
    file_db.write_bytes(b'\x00' * 4096)

    assert check_and_repair(file_db) == 'restored'

    app_two = _build_app()
    with app_two.app_context():
        db.create_all()
        resp = app_two.test_client(use_cookies=False).post('/api/auth/login', json={
            'email': 'survivor@example.com', 'password': 'Quilt7-Morning!'})
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 8. Session-table growth
# ---------------------------------------------------------------------------

def test_session_cap_evicts_oldest_devices(file_app, monkeypatch):
    app, _ = file_app
    monkeypatch.setenv('MAX_SESSIONS_PER_USER', '3')
    client = app.test_client(use_cookies=False)

    reg = client.post('/api/auth/register', json={
        'username': 'multi', 'email': 'multi@example.com',
        'password': 'Quilt7-Morning!', 'confirm_password': 'Quilt7-Morning!'})
    assert reg.status_code == 201

    tokens = [reg.get_json()['access_token']]
    refresh = reg.headers.get('Set-Cookie', '')
    import re
    first_refresh = re.search(r'refresh_token_cookie=([^;]+)', refresh).group(1)

    for _ in range(4):
        r = client.post('/api/auth/login', json={
            'email': 'multi@example.com', 'password': 'Quilt7-Morning!'})
        assert r.status_code == 200

    with app.app_context():
        from app.models import Session as AuthSession
        active = AuthSession.query.filter_by(
            user_id=User.query.filter_by(email='multi@example.com').one().id,
            revoked=False).filter(AuthSession.rotated_at.is_(None)).count()
        assert active == 3

    # The very first device was evicted, so its refresh token is dead.
    resp = client.post('/api/auth/refresh',
                       headers={'Cookie': f'refresh_token_cookie={first_refresh}'})
    assert resp.status_code == 401


def test_rotated_sessions_pruned_only_after_retention(file_app):
    app, _ = file_app
    with app.app_context():
        user = User(username='pruner', email='pruner@example.com')
        user.set_password('PrunerPass123!')
        db.session.add(user)
        db.session.commit()

        old = create_session(user.id, remember=True, request_context=False)
        fresh = create_session(user.id, remember=True, request_context=False)
        db.session.commit()

        from app.models import Session as AuthSession
        from app.models import utcnow
        from datetime import timedelta

        stale = AuthSession.query.filter_by(
            token_hash=session_svc.sha256_hex(old)).one()
        stale.rotated_at = utcnow() - timedelta(days=30)

        current = AuthSession.query.filter_by(
            token_hash=session_svc.sha256_hex(fresh)).one()
        current.rotated_at = utcnow() - timedelta(hours=1)

        removed = prune_expired_sessions()
        assert removed == 1
        assert AuthSession.query.filter_by(token_hash=session_svc.sha256_hex(old)).first() is None
        assert AuthSession.query.filter_by(
            token_hash=session_svc.sha256_hex(fresh)).first() is not None


def test_unexpired_sessions_are_not_pruned(file_app):
    app, _ = file_app
    with app.app_context():
        user = User(username='kept', email='kept@example.com')
        user.set_password('KeptPass123!')
        db.session.add(user)
        db.session.commit()
        create_session(user.id, remember=True, request_context=False)
        db.session.commit()

        assert prune_expired_sessions() == 0
