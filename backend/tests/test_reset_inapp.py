"""In-app password reset (no email provider) — endpoint + full-flow tests.

The /auth/request-password-reset endpoint returns the one-time reset link in
the response itself (ui shows it on /password-reset). Chosen trade-off:
responses differ between registered/unknown emails, so this suite asserts the
difference explicitly. Token properties (hashed, single-use, 30-minute TTL,
session revocation on use) are covered by test_security.py.
"""
import pytest
from urllib.parse import urlparse, parse_qs

from app import create_app
from app import db
from app.models import User


@pytest.fixture
def app():
    import os
    os.environ['SECRET_KEY'] = 'test-secret-key-for-testing-only'
    os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret-key-for-testing-only'
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    os.environ['FRONTEND_ORIGIN'] = 'http://localhost:5173'
    os.environ['JWT_ACCESS_TOKEN_EXPIRES'] = '900'
    os.environ['JWT_REFRESH_TOKEN_EXPIRES'] = '2592000'

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


def request_reset(client, email):
    return client.post('/api/auth/request-password-reset', json={'email': email})


def test_registered_email_gets_one_time_link(client, user):
    resp = request_reset(client, 'test@example.com')
    assert resp.status_code == 202
    body = resp.get_json()
    assert body['reset_link'], body
    assert body['reset_link'].startswith('http://localhost:5173/password-reset?token=')
    assert 'one-time' in body['message'].lower()


def test_unknown_email_gets_no_link(client):
    resp = request_reset(client, 'ghost@example.com')
    assert resp.status_code == 202
    body = resp.get_json()
    assert body['reset_link'] is None
    assert 'one-time' in body['message'].lower()


def test_successive_requests_issue_distinct_tokens(client, user):
    first = request_reset(client, 'test@example.com').get_json()['reset_link']
    second = request_reset(client, 'test@example.com').get_json()['reset_link']
    assert first != second


def _token_from_link(link):
    return parse_qs(urlparse(link).query)['token'][0]


def test_full_flow_request_reset_consume_sign_in_with_new_password(client, user):
    link = request_reset(client, 'test@example.com').get_json()['reset_link']
    token = _token_from_link(link)

    reset = client.post('/api/auth/reset-password', json={
        'token': token, 'password': 'BrandNew123!', 'confirm_password': 'BrandNew123!'})
    assert reset.status_code == 200

    # Old password no longer opens the account; the new one does.
    old_login = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'TestPass123!'})
    assert old_login.status_code in (400, 401)
    new_login = client.post('/api/auth/login', json={
        'email': 'test@example.com', 'password': 'BrandNew123!'})
    assert new_login.status_code == 200


def test_reset_link_is_single_use(client, user):
    link = request_reset(client, 'test@example.com').get_json()['reset_link']
    token = _token_from_link(link)
    first = client.post('/api/auth/reset-password', json={
        'token': token, 'password': 'BrandNew123!', 'confirm_password': 'BrandNew123!'})
    assert first.status_code == 200
    replay = client.post('/api/auth/reset-password', json={
        'token': token, 'password': 'YetAnother123!', 'confirm_password': 'YetAnother123!'})
    assert replay.status_code == 400
