"""Password-reset email delivery (mailers/mailer.py) — unit + integration tests.

The mailer must:
* pick the right provider from env (resend > smtp > skipped),
* always include the FRONTEND_ORIGIN /password-reset?token=… link,
* never raise on provider failure (soft ('failed', reason) return),
* keep /auth/request-password-reset 202-identical whether or not the account
  exists (anti-enumeration) and expose only env-derived email_configured.
"""
import json
import os
import smtplib
import urllib.request
from email.message import EmailMessage
from unittest.mock import patch

import pytest

from app import create_app, db
from app.models import User
from app.mailer import reset_link, send_reset_email, is_email_configured


@pytest.fixture
def app():
    os.environ['SECRET_KEY'] = 'test-secret-key-for-testing-only'
    os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret-key-for-testing-only'
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    os.environ['FRONTEND_ORIGIN'] = 'http://localhost:5173'
    os.environ['JWT_ACCESS_TOKEN_EXPIRES'] = '900'
    os.environ['JWT_REFRESH_TOKEN_EXPIRES'] = '2592000'
    os.environ.pop('RESEND_API_KEY', None)
    for var in ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'):
        os.environ.pop(var, None)

    app = create_app()
    app.config['TESTING'] = True

    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def user(app):
    with app.app_context():
        u = User(username='testuser', email='test@example.com')
        u.set_password('TestPass123!')
        db.session.add(u)
        db.session.commit()
        return u.id


class FakeSMTP:
    """Captures one SMTP session; stands in for smtplib.SMTP (STARTTLS path)."""
    last = None

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port
        self.startedtls = False
        self.logged_in = None
        self.msg = None
        FakeSMTP.last = self

    def starttls(self):
        self.startedtls = True

    def login(self, user, password):
        self.logged_in = user

    def send_message(self, msg):
        self.msg = msg

    def quit(self):
        pass


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return b'{}'


# ---------------------------------------------------------------- unit tests

def test_no_provider_reports_skipped(app):
    assert is_email_configured() is False
    outcome, detail = send_reset_email('me@example.com', 'tester', 'tok123')
    assert outcome == 'skipped'
    assert 'configured' in detail.lower()


def test_reset_link_uses_frontend_origin_and_token(app):
    link = reset_link('abc123')
    assert link == 'http://localhost:5173/password-reset?token=abc123'


def test_smtp_provider_sends_branded_message_with_link(app):
    os.environ['SMTP_HOST'] = 'smtp.test'
    os.environ['SMTP_PORT'] = '587'
    os.environ['SMTP_USER'] = 'no-reply@test'
    os.environ['SMTP_PASSWORD'] = 'secret'
    try:
        with patch.object(smtplib, 'SMTP', FakeSMTP):
            outcome, detail = send_reset_email('me@example.com', 'tester', 'tok123')
        assert outcome == 'sent', detail
        session = FakeSMTP.last
        assert session is not None
        assert session.startedtls is True
        assert session.logged_in == 'no-reply@test'
        msg: EmailMessage = session.msg
        assert msg['To'] == 'me@example.com'
        assert 'Reset your LinuxDocs password' in msg['Subject']
        text = msg.get_body(preferencelist=('plain',)).get_content()
        html = msg.get_body(preferencelist=('html',)).get_content()
        assert '/password-reset?token=tok123' in text
        assert '/password-reset?token=tok123' in html
        assert '30 minutes' in text
        # single-use wording present in either part
        assert 'single-use' in text or 'one-time' in text
    finally:
        for var in ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'):
            os.environ.pop(var, None)


def test_resend_provider_posts_reservation_payload(app):
    os.environ['RESEND_API_KEY'] = 're_test_key'
    captured = {}

    def fake_urlopen(req, timeout=None):
        captured['url'] = req.full_url
        captured['auth'] = req.headers.get('Authorization')
        captured['payload'] = json.loads(req.data.decode())
        return FakeResponse()

    try:
        with patch.object(urllib.request, 'urlopen', fake_urlopen):
            outcome, detail = send_reset_email('me@example.com', 'tester', 'tok456')
        assert outcome == 'sent', detail
        assert captured['url'] == 'https://api.resend.com/emails'
        assert captured['auth'] == 'Bearer re_test_key'
        assert 'me@example.com' in captured['payload']['to']
        assert '/password-reset?token=tok456' in captured['payload']['text']
        assert 'token=tok456' in captured['payload']['html']
    finally:
        os.environ.pop('RESEND_API_KEY', None)


def test_provider_failure_fails_softly(app):
    os.environ['SMTP_HOST'] = 'smtp.test'
    os.environ['SMTP_PORT'] = '587'
    os.environ['SMTP_USER'] = 'no-reply@test'
    os.environ['SMTP_PASSWORD'] = 'secret'
    try:
        with patch.object(smtplib, 'SMTP', side_effect=ConnectionRefusedError('down')):
            outcome, detail = send_reset_email('me@example.com', 'tester', 'tok789')
        assert outcome == 'failed'
        assert 'down' in detail
    finally:
        for var in ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'):
            os.environ.pop(var, None)


# ---------------------------------------------------- endpoint integration

def test_request_password_reset_sends_mail_endpoint_always_202(client, user):
    created = []

    def fake_send(to_email, username, token):
        created.append((to_email, token))
        return 'sent', 'delivered via test'

    with patch('app.auth.send_reset_email', fake_send):
        resp = client.post('/api/auth/request-password-reset',
                           data=json.dumps({'email': 'test@example.com'}),
                           content_type='application/json')
    assert resp.status_code == 202
    assert resp.json['email_configured'] is False
    assert len(created) == 1


def test_request_password_reset_response_identical_for_unknown_email(client):
    resp = client.post('/api/auth/request-password-reset',
                       data=json.dumps({'email': 'nobody@example.com'}),
                       content_type='application/json')
    assert resp.status_code == 202
    assert resp.json['message'] == 'If an account exists for that email, a reset link will be sent.'
    assert resp.json['email_configured'] is False


def test_email_configured_reflects_env_only(client, app):
    os.environ['RESEND_API_KEY'] = 're_test'
    try:
        resp = client.post('/api/auth/request-password-reset',
                           data=json.dumps({'email': 'ghost@example.com'}),
                           content_type='application/json')
        assert resp.status_code == 202
        assert resp.json['email_configured'] is True
    finally:
        os.environ.pop('RESEND_API_KEY', None)


def test_full_flow_with_mailer_link_consumed(client, user):
    """Request → mail delivers token → /reset-password consumes it and revokes sessions."""
    sent_token = {}

    def fake_send(to_email, username, token):
        sent_token['v'] = token
        return 'sent', 'delivered'

    with patch('app.auth.send_reset_email', fake_send):
        resp = client.post('/api/auth/request-password-reset',
                           data=json.dumps({'email': 'test@example.com'}),
                           content_type='application/json')
        assert resp.status_code == 202
    assert sent_token['v']

    from app.mailer import reset_link as build
    link = build(sent_token['v'])
    assert '/password-reset?token=' in link

    resp = client.post('/api/auth/reset-password',
                       data=json.dumps({'token': sent_token['v'],
                                        'password': 'BrandNew123!x',
                                        'confirm_password': 'BrandNew123!x'}),
                       content_type='application/json')
    assert resp.status_code == 200

    # old password no longer works, new one does
    from app.models import User as U
    with client.application.app_context():
        u = U.query.filter_by(email='test@example.com').first()
        assert u.check_password('BrandNew123!x')
