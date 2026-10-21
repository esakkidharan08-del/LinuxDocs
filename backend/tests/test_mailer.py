"""Password-reset security — email delivery + anti-enumeration (mailer suite).

Covers the production requirements:

* existing and unknown addresses get BYTE-IDENTICAL public responses, and no
  reset material ever reaches the API response, the UI, or any log;
* tokens are stored only as SHA-256 hashes (verified against a raw token that
  the dev outbox backend legitimately wrote into a message file);
* expiry, invalid, and already-used tokens are rejected with one neutral
  message; consumption is atomic (concurrent claims: exactly one wins);
* a new request invalidates previous outstanding tokens;
* a successful reset invalidates existing sessions;
* weak/mismatched new passwords are rejected BEFORE the single-use token is
  consumed, so the link survives a typo;
* email-delivery failures never error and never disclose tokens;
* rate limiting and cross-site origin rejection remain effective.
"""
import json
import re
import threading
from datetime import timedelta

import pytest

from app import create_app, db
from app.models import PasswordResetToken, utcnow
from app.security import sha256_hex
from app.sessions import consume_reset_token, create_reset_token
from app import mailer


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('SECRET_KEY', 'test-secret-key-for-testing-only')
    monkeypatch.setenv('JWT_SECRET_KEY', 'test-jwt-secret-key-for-testing-only')
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///:memory:')
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:5173')
    monkeypatch.setenv('JWT_ACCESS_TOKEN_EXPIRES', '900')
    monkeypatch.setenv('JWT_REFRESH_TOKEN_EXPIRES', '2592000')
    monkeypatch.setenv('MAIL_OUTBOX_DIR', str(tmp_path / 'outbox'))
    monkeypatch.delenv('RATE_LIMIT_ENABLED', raising=False)
    monkeypatch.delenv('RESEND_API_KEY', raising=False)
    monkeypatch.delenv('MAIL_DRIVER', raising=False)
    for var in ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'):
        monkeypatch.delenv(var, raising=False)

    application = create_app()
    application.config['TESTING'] = True

    with application.app_context():
        db.create_all()
        yield application
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def user(app):
    with app.app_context():
        from app.models import User
        u = User(username='testuser', email='test@example.com')
        u.set_password('TestPass123!')
        db.session.add(u)
        db.session.commit()
        return u.id


def request_reset(client, email):
    return client.post('/api/auth/request-password-reset', json={'email': email})


def outbox_token(tmp_path, user_id=None):
    """Raw token from the dev mailbox (.eml) — the only sanctioned place a
    raw token exists during development. The message is parsed through the
    email policy so transfer-encoding wraps are decoded before extraction."""
    import email
    from email import policy
    outbox = tmp_path / 'outbox'
    files = sorted(outbox.glob('*.eml'))
    assert files, 'no dev-outbox message was written'
    raw = files[-1].read_bytes()
    msg = email.message_from_bytes(raw, policy=policy.default)
    body = msg.get_body(preferencelist=('plain',))
    match = re.search(r'password-reset\?token=([A-Za-z0-9_-]{20,})',
                      body.get_content() if body else raw.decode('utf-8', 'replace'))
    assert match, f'no reset link inside dev mailbox message: {files[-1].name}'
    return match.group(1), files[-1]


def reset_password(client, token, password='BrandNew123!', confirm='BrandNew123!'):
    return client.post('/api/auth/reset-password', json={
        'token': token, 'password': password, 'confirm_password': confirm})


# --- the public API surface -------------------------------------------------

def test_existing_and_unknown_addresses_get_identical_public_response(client, user):
    existing = request_reset(client, 'test@example.com')
    unknown = request_reset(client, 'ghost@nowhere.dev')
    assert existing.status_code == unknown.status_code == 202
    assert json.dumps(existing.get_json(), sort_keys=True) == \
        json.dumps(unknown.get_json(), sort_keys=True)
    body = existing.get_json()
    assert 'reset_link' not in body and 'token' not in json.dumps(body)
    assert body['email_configured'] is False


def test_email_configured_flag_is_env_only(client, monkeypatch):
    assert request_reset(client, 'any@x.dev').get_json()['email_configured'] is False
    monkeypatch.setenv('SMTP_HOST', 'smtp.example.com')
    monkeypatch.setenv('SMTP_USER', 'ops@example.com')
    monkeypatch.setenv('SMTP_PASSWORD', 'app-password')
    assert request_reset(client, 'any@x.dev').get_json()['email_configured'] is True


def test_request_requires_trusted_origin(client):
    resp = client.post('/api/auth/request-password-reset',
                       json={'email': 'test@example.com'},
                       headers={'Origin': 'https://evil.example'})
    assert resp.status_code != 202


# --- token storage / hashing ------------------------------------------------

def test_token_stored_hashed(app, tmp_path, client, user):
    resp = request_reset(client, 'test@example.com')
    assert resp.status_code == 202
    token, outbox_file = outbox_token(tmp_path)
    assert token not in outbox_file.name
    with app.app_context():
        rows = PasswordResetToken.query.filter_by(user_id=user).all()
        assert len(rows) == 1
        raw_values = {c.name: getattr(rows[0], c.name)
                      for c in PasswordResetToken.__table__.columns}
        # The raw token must not be recoverable from any stored column.
        assert all(raw_values[c.name] != token and token not in str(raw_values[c.name])
                   for c in PasswordResetToken.__table__.columns)
        assert rows[0].token_hash == sha256_hex(token)
        assert rows[0].used_at is None
        # The outbox message legitimately carries the one-time link, built
        # from the trusted configured origin (decoded from transfer encoding).
        import email as email_mod
        from email import policy as email_policy
        parsed = email_mod.message_from_bytes(outbox_file.read_bytes(),
                                              policy=email_policy.default)
        plain = parsed.get_body(preferencelist=('plain',)).get_content()
        assert f'http://localhost:5173/password-reset?token={token}' in plain


def test_new_request_invalidates_previous_tokens(client, user):
    request_reset(client, 'test@example.com')
    request_reset(client, 'test@example.com')
    with client.application.app_context():
        from app.models import PasswordResetToken as PRT
        outstanding = PRT.query.filter_by(user_id=user, used_at=None).all()
        assert len(outstanding) == 1


# --- consumption: expiry / invalid / single-use / atomic --------------------

def test_expired_token_rejected(app, client, user):
    with app.app_context():
        db.session.add(PasswordResetToken(
            user_id=user,
            token_hash=sha256_hex('expired-token-value'),
            expires_at=utcnow() - timedelta(minutes=1)))
        db.session.commit()
    resp = reset_password(client, 'expired-token-value')
    assert resp.status_code == 400
    assert resp.get_json()['errors']['token'] == 'Reset link is invalid or expired'


def test_invalid_and_empty_tokens_rejected(app, client, user):
    for bogus in ('', 'not-a-real-token', 'g' * 60):
        resp = reset_password(client, bogus)
        assert resp.status_code == 400
        assert 'invalid or expired' in resp.get_json()['errors']['token']


def test_token_single_use_replay_rejected(tmp_path, client, user):
    request_reset(client, 'test@example.com')
    token, _ = outbox_token(tmp_path)

    first = reset_password(client, token)
    assert first.status_code == 200
    replay = reset_password(client, token, 'YetAnother55!', 'YetAnother55!')
    assert replay.status_code == 400
    assert 'invalid or expired' in replay.get_json()['errors']['token']

    old_login = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    new_login = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'BrandNew123!'})
    assert old_login.status_code in (400, 401)
    assert new_login.status_code == 200


def test_weak_or_mismatched_password_does_not_burn_token(tmp_path, client, user):
    request_reset(client, 'test@example.com')
    token, _ = outbox_token(tmp_path)

    weak = reset_password(client, token, 'short', 'short')
    assert weak.status_code == 400
    mismatched = reset_password(client, token, 'Other-Good-83%!', 'Different-Good!')
    assert mismatched.status_code == 400

    good = reset_password(client, token)
    assert good.status_code == 200, 'the link must survive failed attempts'


def test_concurrent_consumption_only_one_succeeds(tmp_path, monkeypatch):
    """Two threads race the atomic single-use claim: exactly one wins."""
    monkeypatch.setenv('SECRET_KEY', 'test-secret-key-for-testing-only')
    monkeypatch.setenv('JWT_SECRET_KEY', 'test-jwt-secret-key-for-testing-only')
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path / "atomic.db"}')
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:5173')
    monkeypatch.delenv('RATE_LIMIT_ENABLED', raising=False)

    application = create_app()
    application.config['TESTING'] = True
    user_id = None
    with application.app_context():
        db.create_all()
        from app.models import User
        u = User(username='racer', email='racer@example.com')
        u.set_password('RacerPass99!')
        db.session.add(u)
        db.session.commit()
        user_id = u.id
        token = create_reset_token(user_id)
        db.session.commit()

        barrier = threading.Barrier(2)
        results = []
        errors = []

        def worker():
            try:
                with application.app_context():
                    barrier.wait(timeout=5)
                    results.append(consume_reset_token(token) is not None)
            except Exception as exc:              # pragma: no cover
                errors.append(repr(exc))

        threads = [threading.Thread(target=worker) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)

        assert not errors, errors
        assert sorted(results) == [False, True], (
            'exactly one concurrent claim may win')
        db.drop_all()


# --- account lock-out after successful reset --------------------------------

def test_reset_invalidates_existing_sessions(tmp_path, client, user):
    login = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!', 'remember': True})
    assert login.status_code == 200

    request_reset(client, 'test@example.com')
    token, _ = outbox_token(tmp_path)
    assert reset_password(client, token).status_code == 200

    # The pre-reset refresh cookie can no longer mint access tokens.
    rotated = client.post('/api/auth/refresh')
    assert rotated.status_code in (401, 403)
    fresh = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'BrandNew123!'})
    assert fresh.status_code == 200


# --- rate limiting ------------------------------------------------------------

def test_rate_limit_caps_reset_requests(tmp_path, monkeypatch):
    monkeypatch.setenv('SECRET_KEY', 'test-secret-key-for-testing-only')
    monkeypatch.setenv('JWT_SECRET_KEY', 'test-jwt-secret-key-for-testing-only')
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///:memory:')
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:5173')
    monkeypatch.setenv('MAIL_OUTBOX_DIR', str(tmp_path / 'outbox'))
    monkeypatch.setenv('RATE_LIMIT_ENABLED', '1')
    monkeypatch.setenv('RESET_REQUEST_RATE_LIMIT', '1')

    application = create_app()
    application.config['TESTING'] = True
    with application.app_context():
        db.create_all()
        client = application.test_client()
        first = request_reset(client, 'someone@example.dev')
        flooded = request_reset(client, 'someone@example.dev')
        assert first.status_code == 202
        assert flooded.status_code == 429
        db.drop_all()


# --- delivery failures never disclose ----------------------------------------

def test_delivery_failure_stays_generic_and_hides_token(app, client, user, monkeypatch):
    calls = []
    monkeypatch.setattr(mailer, 'send_reset_email',
                        lambda email, username, token: calls.append(token) or ('failed', 'boom'))
    existing = request_reset(client, 'test@example.com')
    unknown = request_reset(client, 'ghost@nowhere.dev')
    assert existing.status_code == unknown.status_code == 202
    assert json.dumps(existing.get_json(), sort_keys=True) == \
        json.dumps(unknown.get_json(), sort_keys=True)
    assert calls and 'reset_link' not in json.dumps(existing.get_json())


def test_send_reset_email_never_raises(app, monkeypatch, tmp_path):
    monkeypatch.setenv('RESEND_API_KEY', 'test-key')
    monkeypatch.setattr(mailer, '_send_via_resend', None)
    # Point the internal sender at a raiser to prove send_reset_email converts
    # any provider crash into a soft failure.
    def explode(*args, **kwargs):
        raise RuntimeError('provider exploded')
    monkeypatch.setattr(mailer, '_send_via_resend', explode)
    status, detail = mailer.send_reset_email('who@x.dev', 'tester', 'some-token')
    assert status == 'failed'
    assert 'some-token' not in detail
