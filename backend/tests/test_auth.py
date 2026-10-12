import pytest
import json
from app import create_app
from app.models import User, Bookmark, UserNote, RecentlyViewed
from app import db, bcrypt


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


@pytest.fixture
def auth_headers(app, user):
    with app.app_context():
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(user))
        return {'Authorization': f'Bearer {token}'}


def test_register_success(client):
    resp = client.post('/api/auth/register', json={
        'username': 'newuser',
        'email': 'new@example.com',
        'password': 'NewPass123!',
        'confirm_password': 'NewPass123!'
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert 'user' in data
    assert data['user']['username'] == 'newuser'
    assert 'access_token' in data
    assert 'refresh_token_cookie' in resp.headers.get('Set-Cookie', '')


def test_register_duplicate_username(client, app, user):
    with app.app_context():
        resp = client.post('/api/auth/register', json={
            'username': 'testuser',
            'email': 'another@example.com',
            'password': 'NewPass123!',
            'confirm_password': 'NewPass123!'
        })
    assert resp.status_code == 400
    assert 'username' in resp.get_json()['errors']


def test_register_duplicate_email(client, app, user):
    with app.app_context():
        resp = client.post('/api/auth/register', json={
            'username': 'anotheruser',
            'email': 'test@example.com',
            'password': 'NewPass123!',
            'confirm_password': 'NewPass123!'
        })
    assert resp.status_code == 400
    assert 'email' in resp.get_json()['errors']


def test_register_weak_password(client):
    resp = client.post('/api/auth/register', json={
        'username': 'newuser',
        'email': 'new@example.com',
        'password': 'weak',
        'confirm_password': 'weak'
    })
    assert resp.status_code == 400
    assert 'password' in resp.get_json()['errors']


def test_register_mismatched_passwords(client):
    resp = client.post('/api/auth/register', json={
        'username': 'newuser',
        'email': 'new@example.com',
        'password': 'NewPass123!',
        'confirm_password': 'Different123!'
    })
    assert resp.status_code == 400
    assert 'confirm_password' in resp.get_json()['errors']


def test_login_success(client, app, user):
    with app.app_context():
        resp = client.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'TestPass123!'
        })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['user']['email'] == 'test@example.com'
    assert 'access_token' in data
    assert 'refresh_token_cookie' in resp.headers.get('Set-Cookie', '')


def test_login_wrong_password(client, app, user):
    with app.app_context():
        resp = client.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'WrongPass123!'
        })
    assert resp.status_code == 401
    assert 'general' in resp.get_json()['errors']


def test_login_nonexistent_user(client):
    resp = client.post('/api/auth/login', json={
        'email': 'nonexistent@example.com',
        'password': 'TestPass123!'
    })
    assert resp.status_code == 401


def test_refresh_token_with_valid_cookie(client, app, user):
    """Test refresh endpoint with a valid refresh token cookie from login."""
    with app.app_context():
        # First login to get refresh cookie
        resp = client.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'TestPass123!'
        })
        assert resp.status_code == 200
        set_cookie = resp.headers.get('Set-Cookie', '')
        # Extract refresh token cookie
        import re
        match = re.search(r'refresh_token_cookie=([^;]+)', set_cookie)
        assert match, f'No refresh token cookie in: {set_cookie}'
        refresh_cookie = f'refresh_token_cookie={match.group(1)}'

    # Use refresh token to get new access token
    resp = client.post('/api/auth/refresh', headers={'Cookie': refresh_cookie})
    assert resp.status_code == 200
    assert 'access_token' in resp.get_json()


def test_refresh_expired_token(client):
    with client.application.app_context():
        from flask_jwt_extended import create_refresh_token
        from datetime import timedelta
        from app import create_app
        test_app = create_app()
        test_app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(seconds=-1)
        with test_app.app_context():
            token = create_refresh_token(identity='1')

    resp = client.post('/api/auth/refresh', headers={'Cookie': f'refresh_token_cookie={token}'})
    assert resp.status_code == 401


def test_refresh_missing_token(client):
    resp = client.post('/api/auth/refresh')
    assert resp.status_code == 401


def test_refresh_tampered_token(client):
    resp = client.post('/api/auth/refresh', headers={'Cookie': 'refresh_token_cookie=tampered.token.here'})
    assert resp.status_code == 401


def test_logout(client, app, user):
    with app.app_context():
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(user))
        headers = {'Authorization': f'Bearer {token}'}
        resp = client.post('/api/auth/logout', headers=headers)
    assert resp.status_code == 200
    # Logout should clear at least the access token cookie
    set_cookie = resp.headers.get('Set-Cookie', '')
    assert 'access_token_cookie=;' in set_cookie or 'access_token_cookie=deleted' in set_cookie


def test_me_authenticated(client, auth_headers):
    resp = client.get('/api/auth/me', headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()['user']['username'] == 'testuser'


def test_me_unauthenticated(client):
    resp = client.get('/api/auth/me')
    assert resp.status_code == 401


# --- USER ENDPOINTS ---

def test_get_bookmarks(client, auth_headers):
    resp = client.get('/api/user/bookmarks', headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()['bookmarks'] == []


def test_toggle_bookmark_add(client, auth_headers):
    resp = client.post('/api/user/bookmarks/toggle', headers=auth_headers, json={'command_slug': 'ls'})
    assert resp.status_code == 201
    assert resp.get_json()['bookmarked'] is True


def test_toggle_bookmark_remove(client, auth_headers):
    client.post('/api/user/bookmarks/toggle', headers=auth_headers, json={'command_slug': 'ls'})
    resp = client.post('/api/user/bookmarks/toggle', headers=auth_headers, json={'command_slug': 'ls'})
    assert resp.status_code == 200
    assert resp.get_json()['bookmarked'] is False


def test_cross_user_bookmark_isolation(app, client, user):
    with app.app_context():
        from flask_jwt_extended import create_access_token
        u2 = User(username='user2', email='user2@example.com')
        u2.set_password('TestPass123!')
        db.session.add(u2)
        db.session.commit()
        token2 = create_access_token(identity=str(u2.id))
        headers2 = {'Authorization': f'Bearer {token2}'}

    # Get auth headers for user1
    with app.app_context():
        from flask_jwt_extended import create_access_token
        token1 = create_access_token(identity=str(user))
        headers1 = {'Authorization': f'Bearer {token1}'}

    # User 1 adds bookmark
    client.post('/api/user/bookmarks/toggle', headers=headers1, json={'command_slug': 'ls'})
    # User 2 gets bookmarks - should be empty
    resp = client.get('/api/user/bookmarks', headers=headers2)
    assert resp.status_code == 200
    assert resp.get_json()['bookmarks'] == []


def test_upsert_note(client, auth_headers):
    resp = client.post('/api/user/notes', headers=auth_headers, json={
        'command_slug': 'ls',
        'text': 'My note about ls'
    })
    assert resp.status_code == 200
    assert resp.get_json()['note']['text'] == 'My note about ls'


def test_update_note(client, auth_headers):
    client.post('/api/user/notes', headers=auth_headers, json={
        'command_slug': 'ls',
        'text': 'First note'
    })
    resp = client.post('/api/user/notes', headers=auth_headers, json={
        'command_slug': 'ls',
        'text': 'Updated note'
    })
    assert resp.status_code == 200
    assert resp.get_json()['note']['text'] == 'Updated note'


def test_delete_note(client, auth_headers):
    client.post('/api/user/notes', headers=auth_headers, json={
        'command_slug': 'ls',
        'text': 'To delete'
    })
    resp = client.delete('/api/user/notes/ls', headers=auth_headers)
    assert resp.status_code == 200

    resp = client.get('/api/user/notes', headers=auth_headers)
    assert len(resp.get_json()['notes']) == 0


def test_cross_user_note_isolation(app, client, user):
    with app.app_context():
        from flask_jwt_extended import create_access_token
        u2 = User(username='user2', email='user2@example.com')
        u2.set_password('TestPass123!')
        db.session.add(u2)
        db.session.commit()
        token2 = create_access_token(identity=str(u2.id))
        headers2 = {'Authorization': f'Bearer {token2}'}

    # Get auth headers for user1
    with app.app_context():
        from flask_jwt_extended import create_access_token
        token1 = create_access_token(identity=str(user))
        headers1 = {'Authorization': f'Bearer {token1}'}

    # User 1 adds note
    client.post('/api/user/notes', headers=headers1, json={
        'command_slug': 'ls',
        'text': 'User1 note'
    })
    # User 2 gets notes - should be empty
    resp = client.get('/api/user/notes', headers=headers2)
    assert resp.status_code == 200
    assert resp.get_json()['notes'] == []


def test_get_history(client, auth_headers):
    resp = client.get('/api/user/history', headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()['history'] == []


def test_add_history(client, auth_headers):
    resp = client.post('/api/user/history/add', headers=auth_headers, json={'command_slug': 'ls'})
    assert resp.status_code == 200

    resp = client.get('/api/user/history', headers=auth_headers)
    assert len(resp.get_json()['history']) == 1
    assert resp.get_json()['history'][0]['command_slug'] == 'ls'


def test_history_capped_at_15(client, auth_headers):
    for i in range(20):
        client.post('/api/user/history/add', headers=auth_headers, json={'command_slug': f'cmd{i}'})
    resp = client.get('/api/user/history', headers=auth_headers)
    assert len(resp.get_json()['history']) == 15
    slugs = [h['command_slug'] for h in resp.get_json()['history']]
    assert slugs == [f'cmd{i}' for i in range(19, 4, -1)]


def test_change_password_success(client, auth_headers, app):
    resp = client.post('/api/user/change-password', headers=auth_headers, json={
        'current_password': 'TestPass123!',
        'new_password': 'NewPass456!',
        'confirm_password': 'NewPass456!'
    })
    assert resp.status_code == 200

    with app.app_context():
        resp = client.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'NewPass456!'
        })
    assert resp.status_code == 200


def test_change_password_wrong_current(client, auth_headers):
    resp = client.post('/api/user/change-password', headers=auth_headers, json={
        'current_password': 'WrongPass123!',
        'new_password': 'NewPass456!',
        'confirm_password': 'NewPass456!'
    })
    assert resp.status_code == 400
    assert 'current_password' in resp.get_json()['errors']


def test_change_password_weak_new(client, auth_headers):
    resp = client.post('/api/user/change-password', headers=auth_headers, json={
        'current_password': 'TestPass123!',
        'new_password': 'weak',
        'confirm_password': 'weak'
    })
    assert resp.status_code == 400
    assert 'new_password' in resp.get_json()['errors']


def test_delete_account_success(client, auth_headers, app):
    resp = client.delete('/api/user/delete-account', headers=auth_headers, json={
        'confirm': 'testuser'
    })
    assert resp.status_code == 200

    with app.app_context():
        assert User.query.filter_by(username='testuser').first() is None
        assert Bookmark.query.count() == 0
        assert UserNote.query.count() == 0
        assert RecentlyViewed.query.count() == 0


def test_delete_account_wrong_confirm(client, auth_headers):
    resp = client.delete('/api/user/delete-account', headers=auth_headers, json={
        'confirm': 'wrongusername'
    })
    assert resp.status_code == 400
    assert 'confirm' in resp.get_json()['errors']


def test_delete_account_cascades_data(client, auth_headers, app):
    client.post('/api/user/bookmarks/toggle', headers=auth_headers, json={'command_slug': 'ls'})
    client.post('/api/user/notes', headers=auth_headers, json={'command_slug': 'ls', 'text': 'note'})
    client.post('/api/user/history/add', headers=auth_headers, json={'command_slug': 'ls'})

    resp = client.delete('/api/user/delete-account', headers=auth_headers, json={
        'confirm': 'testuser'
    })
    assert resp.status_code == 200

    with app.app_context():
        assert Bookmark.query.count() == 0
        assert UserNote.query.count() == 0
        assert RecentlyViewed.query.count() == 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])