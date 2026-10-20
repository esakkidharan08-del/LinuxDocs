"""Security hardening tests: rate limits, lockout, opaque rotating sessions,
password-reset tokens, security headers, CSRF origin checks, payload guards."""

import json
import os
import re

import pytest
from app import create_app, db
from app.models import Session as AuthSession
from app.models import User
import app.sessions as session_svc


@pytest.fixture
def app():
    os.environ['SECRET_KEY'] = 'test-secret-key-for-testing-only'
    os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret-key-for-testing-only'
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    os.environ['FRONTEND_ORIGIN'] = 'http://localhost:5173'
    os.environ['JWT_ACCESS_TOKEN_EXPIRES'] = '900'
    os.environ['JWT_REFRESH_TOKEN_EXPIRES'] = '2592000'

    # Keep module-level limiter/lockout state isolated per test.
    from app.security import limiter, lockout_store
    limiter.reset()
    lockout_store.clear()

    app = create_app()
    app.config['TESTING'] = True

    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    # use_cookies=False: the Werkzeug client's cookie jar otherwise overwrites
    # explicit Cookie headers via inject_wsgi, hiding rotation/reuse behaviour.
    return app.test_client(use_cookies=False)


@pytest.fixture
def user(app):
    with app.app_context():
        u = User(username='testuser', email='test@example.com')
        u.set_password('TestPass123!')
        db.session.add(u)
        db.session.commit()
        return u.id


def grab_refresh_cookie(resp):
    set_cookie = resp.headers.get('Set-Cookie', '')
    match = re.search(r'refresh_token_cookie=([^;]+)', set_cookie)
    assert match, f'No refresh cookie in {set_cookie}'
    return match.group(1)


# ---------------------------------------------------------------------------
# Rate limiting & lockout
# ---------------------------------------------------------------------------

def test_login_rate_limited_when_enabled(client, app, user, monkeypatch):
    monkeypatch.setenv('RATE_LIMIT_ENABLED', '1')
    monkeypatch.setenv('LOGIN_RATE_LIMIT', '3')
    for _ in range(3):
        r = client.post('/api/auth/login', json={
            'email': 'test@example.com', 'password': 'WrongPass123!'})
        assert r.status_code == 401
    r = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'WrongPass123!'})
    assert r.status_code == 429


def test_account_lockout_after_repeated_failures(client, app, user, monkeypatch):
    monkeypatch.setenv('RATE_LIMIT_ENABLED', '1')
    monkeypatch.setenv('LOGIN_RATE_LIMIT', '50')
    monkeypatch.setenv('LOGIN_ACCOUNT_ATTEMPTS', '4')
    for _ in range(4):
        r = client.post('/api/auth/login', json={
            'email': 'test@example.com', 'password': 'WrongPass123!'})
        assert r.status_code == 401
    # 5th attempt: account is locked out even with the correct password
    r = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    assert r.status_code == 429
    assert 'locked' in r.get_json()['errors']['general'].lower()


def test_rate_limiting_off_by_default_in_testing(client):
    # Default (TESTING) profile must stay deterministic for the old suite.
    for _ in range(25):
        r = client.post('/api/auth/login', json={
            'email': 'nobody@example.com', 'password': 'WrongPass123!'})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Opaque rotating sessions + reuse detection
# ---------------------------------------------------------------------------

def test_refresh_rotates_token_and_old_token_reuse_within_grace(client, app, user):
    resp = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    old_token = grab_refresh_cookie(resp)

    resp = client.post('/api/auth/refresh', headers={'Cookie': f'refresh_token_cookie={old_token}'})
    assert resp.status_code == 200
    new_token = grab_refresh_cookie(resp)
    assert new_token != old_token

    # Old token still tolerated within the grace window (parallel refresh).
    resp = client.post('/api/auth/refresh', headers={'Cookie': f'refresh_token_cookie={old_token}'})
    assert resp.status_code == 200


def test_old_token_reuse_after_grace_revokes_all(client, app, user, monkeypatch):
    monkeypatch.setattr(session_svc, 'TOKEN_REUSE_GRACE_SECONDS', -10)
    resp = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    old_token = grab_refresh_cookie(resp)

    resp = client.post('/api/auth/refresh', headers={'Cookie': f'refresh_token_cookie={old_token}'})
    assert resp.status_code == 200
    new_token = grab_refresh_cookie(resp)

    # Reuse of the rotated-out token = theft -> entire account revoked.
    resp = client.post('/api/auth/refresh', headers={'Cookie': f'refresh_token_cookie={old_token}'})
    assert resp.status_code == 401
    resp = client.post('/api/auth/refresh', headers={'Cookie': f'refresh_token_cookie={new_token}'})
    assert resp.status_code == 401


def test_logout_revokes_session(client, app, user):
    resp = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    token = grab_refresh_cookie(resp)

    resp = client.post('/api/auth/logout', headers={'Cookie': f'refresh_token_cookie={token}'})
    assert resp.status_code == 200

    resp = client.post('/api/auth/refresh', headers={'Cookie': f'refresh_token_cookie={token}'})
    assert resp.status_code == 401


def test_remember_cookie_duration(client, app, user):
    resp = client.post('/api/auth/login', headers={
        'Origin': 'http://localhost:5173'}, json={
        'email': 'test@example.com', 'password': 'TestPass123!', 'remember': True})
    set_cookie = resp.headers.get('Set-Cookie', '')
    assert 'Max-Age=31536000' in set_cookie
    assert 'HttpOnly' in set_cookie
    assert 'SameSite=Strict' in set_cookie

    resp = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!', 'remember': False})
    set_cookie = resp.headers.get('Set-Cookie', '')
    assert 'Max-Age=' not in set_cookie.replace(' ', '')  # browser-session cookie


def test_samesite_is_configurable(client, app, user, monkeypatch):
    # Default stays Strict (CSRF-hardened) — verified in the test above.
    # Cross-site deployments can opt into None, which must force Secure.
    monkeypatch.setenv('SESSION_COOKIE_SAMESITE', 'None')
    resp = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    set_cookie = resp.headers.get('Set-Cookie', '')
    assert 'SameSite=None' in set_cookie
    assert 'Secure' in set_cookie

    monkeypatch.setenv('SESSION_COOKIE_SAMESITE', 'bogus-value')
    resp = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    assert 'SameSite=Strict' in resp.headers.get('Set-Cookie', '')  # safe fallback


# ---------------------------------------------------------------------------
# Password reset tokens (opaque, single-use)
# ---------------------------------------------------------------------------

def test_reset_token_single_use(client, app, user):
    with app.app_context():
        token = session_svc.create_reset_token(user)
        db.session.commit()

    resp = client.post('/api/auth/reset-password', json={
        'token': token, 'password': 'FreshPass456!', 'confirm_password': 'FreshPass456!'})
    assert resp.status_code == 200

    # Token is now single-use.
    resp = client.post('/api/auth/reset-password', json={
        'token': token, 'password': 'FreshPass789!', 'confirm_password': 'FreshPass789!'})
    assert resp.status_code == 400

    # New password actually works.
    resp = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'FreshPass456!'})
    assert resp.status_code == 200


def test_reset_request_uniform_response(client, app, user):
    r1 = client.post('/api/auth/request-password-reset', json={'email': 'test@example.com'})
    r2 = client.post('/api/auth/request-password-reset', json={'email': 'nobody@example.com'})
    assert r1.status_code == r2.status_code == 202
    assert r1.get_json()['message'] == r2.get_json()['message']


# ---------------------------------------------------------------------------
# Headers, origin checks, payload guards
# ---------------------------------------------------------------------------

def test_security_headers_present(client):
    r = client.get('/api/health')
    assert r.headers.get('X-Content-Type-Options') == 'nosniff'
    assert r.headers.get('X-Frame-Options') == 'DENY'
    assert r.headers.get('Referrer-Policy') == 'strict-origin-when-cross-origin'
    assert 'geolocation=()' in r.headers.get('Permissions-Policy', '')
    assert r.headers.get('X-Request-ID')


def test_cross_origin_state_change_rejected(client, app, user):
    r = client.post('/api/auth/login',
                    headers={'Origin': 'https://evil.example.com'},
                    json={'email': 'test@example.com', 'password': 'TestPass123!'})
    assert r.status_code == 403


def test_same_origin_allowed(client, app, user):
    r = client.post('/api/auth/login',
                    headers={'Origin': 'http://localhost:5173'},
                    json={'email': 'test@example.com', 'password': 'TestPass123!'})
    assert r.status_code == 200


def test_wrong_content_type_rejected(client, app, user):
    r = client.post('/api/auth/login',
                    data='email=test@example.com&password=TestPass123!',
                    content_type='application/x-www-form-urlencoded')
    assert r.status_code == 415


def test_sessions_are_stored_hashed(client, app, user):
    set_cookie = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'}).headers.get('Set-Cookie', '')
    raw = re.search(r'refresh_token_cookie=([^;]+)', set_cookie).group(1)
    with app.app_context():
        from app.security import sha256_hex
        assert raw != sha256_hex(raw)          # the wire token is its hash, not itself
        row = AuthSession.query.filter_by(token_hash=sha256_hex(raw)).first()
        assert row is not None                  # stored only as a hash
        column_names = [c.name for c in AuthSession.__table__.columns]
        assert 'token_hash' in column_names
        assert 'token' not in column_names      # plaintext never persisted


def test_password_change_revokes_other_sessions(client, app, user):
    # Two sessions (two "devices")
    r1 = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    token1 = grab_refresh_cookie(r1)
    access1 = r1.get_json()['access_token']
    r2 = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    token2 = grab_refresh_cookie(r2)

    # Change password from device 1 (keeps device 1 signed in)
    r = client.post('/api/user/change-password',
                    headers={'Authorization': f'Bearer {access1}',
                             'Cookie': f'refresh_token_cookie={token1}',
                             'Origin': 'http://localhost:5173'},
                    json={'current_password': 'TestPass123!',
                          'new_password': 'NewPass456!',
                          'confirm_password': 'NewPass456!'})
    assert r.status_code == 200

    # Device 2 must now be dead
    r = client.post('/api/auth/refresh', headers={'Cookie': f'refresh_token_cookie={token2}'})
    assert r.status_code == 401
    # Device 1 still works
    r = client.post('/api/auth/refresh', headers={'Cookie': f'refresh_token_cookie={token1}'})
    assert r.status_code == 200


def test_common_password_rejected(client):
    # Passes every complexity rule but is on the known-breached list.
    r = client.post('/api/auth/register', json={
        'username': 'weakuser', 'email': 'weak@example.com',
        'password': 'Password1!', 'confirm_password': 'Password1!'})
    assert r.status_code == 400
    assert 'password' in r.get_json()['errors']