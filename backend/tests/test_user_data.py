"""User-data ownership + sync-hardening regression tests.

Covers the Task-2 production requirements:
* every bookmark/note/history record is strict per-user property (a second
  authenticated user can neither read, mutate, nor even discover them);
* /user/bookmarks/set is idempotent desired-state semantics (replaying
  wanted=true can never delete an existing bookmark — the property the offline
  replay queue depends on);
* data import validates shape/count/slug-charset and silently skips junk
  items instead of persisting them.
"""
import pytest

from app import create_app, db


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('SECRET_KEY', 'test-secret-key-for-testing-only')
    monkeypatch.setenv('JWT_SECRET_KEY', 'test-jwt-secret-key-for-testing-only')
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///:memory:')
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:5173')
    monkeypatch.delenv('RATE_LIMIT_ENABLED', raising=False)
    monkeypatch.delenv('RESEND_API_KEY', raising=False)
    monkeypatch.delenv('MAIL_DRIVER', raising=False)

    application = create_app()
    application.config['TESTING'] = True
    with application.app_context():
        db.create_all()
        yield application
        db.drop_all()


# helpers -------------------------------------------------------------------

def register_and_get_token(app, suffix):
    c = app.test_client()
    resp = c.post('/api/auth/register', json={
        'username': f'user{suffix}', 'email': f'user{suffix}@example.com',
        'password': f'Password-{suffix}90!', 'confirm_password': f'Password-{suffix}90!'})
    assert resp.status_code == 201
    token = resp.get_json()['access_token']
    return c, {'Authorization': f'Bearer {token}'}


# ownership -------------------------------------------------------------------

def test_bookmarks_are_per_user_isolated(app):
    _, ha = register_and_get_token(app, 'a')
    _, hb = register_and_get_token(app, 'b')

    assert app.test_client().post('/api/user/bookmarks/toggle', json={'command_slug': 'linux/file-and-directory/cp'},
                                  headers=ha).status_code == 201
    listed_b = app.test_client().get('/api/user/bookmarks', headers=hb)
    slugs = [b['command_slug'] for b in listed_b.get_json()['bookmarks']]
    assert listed_b.status_code == 200 and slugs == []
    assert 'note' not in listed_b.get_json()


def test_notes_are_per_user_isolated(app):
    _, ha = register_and_get_token(app, 'a')
    _, hb = register_and_get_token(app, 'b')
    client = app.test_client()

    assert client.post('/api/user/notes', json={'command_slug': 'linux/text-processing/grep', 'text': 'private note'},
                       headers=ha).status_code == 200
    notes_b = client.get('/api/user/notes', headers=hb).get_json()['notes']
    assert notes_b == []
    # B cannot update or delete A's note by slug either.
    assert client.post('/api/user/notes', json={'command_slug': 'unknown-slug-for-b', 'text': 'x'}, headers=hb)
    resp = client.delete('/api/user/notes/linux/text-processing/grep', headers=hb)
    assert resp.status_code == 404
    still_there = client.get('/api/user/notes', headers=ha).get_json()['notes']
    assert [n['text'] for n in still_there] == ['private note']


def test_history_is_per_user_isolated(app):
    _, ha = register_and_get_token(app, 'a')
    _, hb = register_and_get_token(app, 'b')
    client = app.test_client()
    assert client.post('/api/user/history/add', json={'command_slug': 'linux/process-management/kill'},
                       headers=ha).status_code == 200
    hist_b = client.get('/api/user/history', headers=hb).get_json()['history']
    assert hist_b == []


# idempotent desired-state set (offline replay primitive) ----------------------

def test_set_bookmark_is_idempotent_desired_state(app):
    _, ha = register_and_get_token(app, 'a')
    client = app.test_client()
    url = '/api/user/bookmarks/set'
    body = lambda wanted: {'command_slug': 'linux/file-and-directory/cp', 'wanted': wanted}

    assert client.post(url, json=body(True), headers=ha).get_json()['bookmarked'] is True    # creates once
    assert client.post(url, json=body(True), headers=ha).get_json()['bookmarked'] is True    # replay keeps it
    assert client.post(url, json=body(False), headers=ha).get_json()['bookmarked'] is False  # removes
    assert client.post(url, json=body(False), headers=ha).get_json()['bookmarked'] is False  # replay stays removed
    listed = [b['command_slug'] for b in client.get('/api/user/bookmarks', headers=ha).get_json()['bookmarks']]
    assert listed == []


def test_set_bookmark_validates_wanted_type(app):
    _, ha = register_and_get_token(app, 'a')
    resp = app.test_client().post('/api/user/bookmarks/set',
                                  json={'command_slug': 'x', 'wanted': 'yes'}, headers=ha)
    assert resp.status_code == 400


# import validation -------------------------------------------------------------

def test_import_rejects_wrong_shapes_and_counts(app):
    _, ha = register_and_get_token(app, 'a')
    client = app.test_client()
    bad_shape = client.post('/api/user/data/import',
                            json={'bookmarks': 'nope', 'notes': []}, headers=ha)
    assert bad_shape.status_code == 400
    too_many = client.post('/api/user/data/import',
                           json={'bookmarks': [f's/{i}' for i in range(2001)], 'notes': []}, headers=ha)
    assert too_many.status_code == 400
    assert 'limited to' in too_many.get_json()['error']


def test_import_skips_junk_slugs_imports_real_ones(app):
    _, ha = register_and_get_token(app, 'a')
    client = app.test_client()
    resp = client.post('/api/user/data/import', json={
        'bookmarks': ['linux/file-and-directory/cp', 'bad slug with spaces!!', 'x' * 250],
        'notes': [
            {'command_slug': 'linux/text-processing/grep', 'text': 'keep me'},
            {'command_slug': 'bad slug!~', 'text': 'drop me'},
            {'command_slug': 'linux/system-info-and-monitoring/uname', 'text': 'also keep'},
        ]}, headers=ha)
    assert resp.status_code == 200
    slugs = {b['command_slug'] for b in client.get('/api/user/bookmarks', headers=ha).get_json()['bookmarks']}
    assert slugs == {'linux/file-and-directory/cp'}
    notes = {n['command_slug']: n['text'] for n in client.get('/api/user/notes', headers=ha).get_json()['notes']}
    assert notes == {'linux/text-processing/grep': 'keep me',
                     'linux/system-info-and-monitoring/uname': 'also keep'}


def test_import_notes_overwrite_serves_deterministic_newest_wins(app):
    _, ha = register_and_get_token(app, 'a')
    client = app.test_client()
    client.post('/api/user/notes', json={'command_slug': 'linux/text-processing/grep', 'text': 'old text'}, headers=ha)
    client.post('/api/user/data/import',
                json={'bookmarks': [], 'notes': [{'command_slug': 'linux/text-processing/grep', 'text': 'imported text'}]},
                headers=ha)
    notes = {n['command_slug']: n['text'] for n in client.get('/api/user/notes', headers=ha).get_json()['notes']}
    assert notes['linux/text-processing/grep'] == 'imported text'


def test_no_note_content_in_log_lines(app, caplog):
    _, ha = register_and_get_token(app, 'a')
    client = app.test_client()
    client.post('/api/user/notes',
                json={'command_slug': 'linux/text-processing/grep', 'text': 'SECRET-SENTINEL-42'}, headers=ha)
    client.get('/api/user/notes', headers=ha)
    for record in caplog.records:
        assert 'SECRET-SENTINEL-42' not in record.getMessage()
