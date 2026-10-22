"""Synced learning progress endpoints (Part 2) — protocol + hardening.

Covers the Part-2 production requirements:
* GET/PUT /api/user/progress with the optimistic-version conflict protocol
  (a stale baseVersion answers 409 carrying the current row);
* strict per-key schema validation (unknown keys/fields, wrong types,
  out-of-range values, 64 KB cap — all rejected, nothing half-written);
* per-user isolation (progress is strictly its owner's property);
* the streak ±1-day window around the server's clock;
* schema-v2 import with server-side deterministic merge (and clean rejects).
"""

import json
from datetime import timedelta

import pytest

from app import create_app, db
from app.progress_schemas import MAX_DATA_BYTES, server_today

LEARNING = {
    'shell-basics': {'completed': False, 'bestScore': 0, 'bestTotal': 0, 'lessons': ['0']},
}
STREAK = {'lastDay': server_today().isoformat(), 'current': 3, 'best': 5, 'totalDays': 29}


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


def register_and_get_token(app, suffix):
    c = app.test_client()
    resp = c.post('/api/auth/register', json={
        'username': f'user{suffix}', 'email': f'user{suffix}@example.com',
        'password': f'Password-{suffix}90!', 'confirm_password': f'Password-{suffix}90!'})
    assert resp.status_code == 201
    token = resp.get_json()['access_token']
    return c, {'Authorization': f'Bearer {token}'}


# happy path: create → read → bump --------------------------------------------------

def test_put_then_get_roundtrip(app):
    c, head = register_and_get_token(app, 'p')
    put = c.put('/api/user/progress/learning', json={'baseVersion': 0, 'data': LEARNING}, headers=head)
    assert put.status_code == 200
    assert put.get_json()['version'] == 1

    got = c.get('/api/user/progress', headers=head)
    assert got.status_code == 200
    row = got.get_json()['progress']['learning']
    assert row['version'] == 1 and row['data'] == LEARNING


def test_version_bumps_on_every_accepted_put(app):
    c, head = register_and_get_token(app, 'v')
    v0 = c.put('/api/user/progress/speeddrill', json={'baseVersion': 0, 'data': {'best': 1, 'plays': 1}}, headers=head)
    assert v0.get_json()['version'] == 1
    v1 = c.put('/api/user/progress/speeddrill', json={'baseVersion': 1, 'data': {'best': 2, 'plays': 2}}, headers=head)
    assert v1.status_code == 200 and v1.get_json()['version'] == 2
    got = c.get('/api/user/progress', headers=head).get_json()['progress']['speeddrill']
    assert got['data'] == {'best': 2, 'plays': 2}


# conflict protocol -----------------------------------------------------------------

def test_stale_base_version_conflicts_with_current_data(app):
    c, head = register_and_get_token(app, 'c')
    first = c.put('/api/user/progress/learning', json={'baseVersion': 0, 'data': LEARNING}, headers=head)
    assert first.status_code == 200
    newer = {'shell-basics': {'completed': True, 'bestScore': 9, 'bestTotal': 10, 'lessons': ['0', '1']}}
    assert c.put('/api/user/progress/learning', json={'baseVersion': 1, 'data': newer}, headers=head).status_code == 200

    stale = c.put('/api/user/progress/learning', json={'baseVersion': 0, 'data': LEARNING}, headers=head)
    assert stale.status_code == 409
    body = stale.get_json()
    assert body['key'] == 'learning' and body['version'] == 2
    assert body['data'] == newer  # 409 carries the current truth for the client merge


def test_absent_row_conflicts_only_when_base_version_positive(app):
    c, head = register_and_get_token(app, 'a1')
    resp = c.put('/api/user/progress/streak', json={'baseVersion': 1, 'data': STREAK}, headers=head)
    assert resp.status_code == 409
    body = resp.get_json()
    assert body['version'] == 0 and body['data'] is None


# request hardening ------------------------------------------------------------------

def test_unknown_key_and_bad_body_rejected(app):
    c, head = register_and_get_token(app, 'b1')
    assert c.put('/api/user/progress/nope', json={'baseVersion': 0, 'data': {}}, headers=head).status_code == 400
    assert c.put('/api/user/progress/streak', 'not-json', headers=head).status_code == 400
    assert c.put('/api/user/progress/streak', json={'baseVersion': -1, 'data': STREAK}, headers=head).status_code == 400
    assert c.put('/api/user/progress/streak', json={'baseVersion': 0}, headers=head).status_code == 400
    assert c.put('/api/user/progress/streak', json={'baseVersion': True, 'data': STREAK}, headers=head).status_code == 400


def test_get_requires_auth(app):
    assert app.test_client().get('/api/user/progress').status_code == 401
    assert app.test_client().put('/api/user/progress/streak', json={}).status_code == 401


def test_payload_size_cap(app):
    c, head = register_and_get_token(app, 's1')
    huge = {f'path-{i:0>3}': {'completed': False, 'bestScore': 0, 'bestTotal': 0,
                              'lessons': [str(j % 1000) for j in range(400)]} for i in range(40)}
    assert len(json.dumps(huge, separators=(',', ':'))) > MAX_DATA_BYTES
    # the size guard runs BEFORE schema validation → a 413, not a schema 400
    resp = c.put('/api/user/progress/learning', json={'baseVersion': 0, 'data': huge}, headers=head)
    assert resp.status_code == 413


def test_oversize_threshold_matches_schema_constant(app):
    assert MAX_DATA_BYTES == 64 * 1024


# strict per-key schema --------------------------------------------------------------

@pytest.mark.parametrize('key,data,fragment', [
    ('learning', {'Bad Path!': LEARNING['shell-basics']}, 'path'),
    ('learning', {'shell-basics': {'completed': False, 'bestScore': 2, 'bestTotal': 1, 'lessons': []}}, 'bestScore'),
    ('learning', {'shell-basics': {'completed': 'yes', 'bestScore': 0, 'bestTotal': 0, 'lessons': []}}, 'boolean'),
    ('learning', {'shell-basics': {'completed': False, 'bestScore': 0, 'bestTotal': 0, 'lessons': ['xx'], 'extra': 1}}, 'unknown'),
    ('terminal', {'solved': ['m1', 'm1'], 'commandsRun': 0}, 'duplicates'),
    ('terminal', {'solved': ['x99'], 'commandsRun': 0}, 'mission'),
    ('terminal', {'solved': [], 'commandsRun': True}, 'integer'),
    ('terminal', {'solved': [], 'commandsRun': -4}, 'integer'),
    ('flashcards', {'completes': {'deck': 'no'}}, 'integer'),
    ('flashcards', {'completes': {}, 'extra': 1}, 'unknown'),
    ('speeddrill', {'best': 10 ** 9, 'plays': 0}, 'integer'),
    ('speeddrill', {'best': 1, 'plays': 2, 'extra': 'x'}, 'unknown'),
    ('streak', {'lastDay': '2026-13-01', 'current': 0, 'best': 0, 'totalDays': 0}, 'real date'),
    ('streak', {**STREAK, 'best': 1}, 'best'),
])
def test_schema_rejects_garbage(app, key, data, fragment):
    c, head = register_and_get_token(app, 'g' + key[:2])
    resp = c.put(f'/api/user/progress/{key}', json={'baseVersion': 0, 'data': data}, headers=head)
    assert resp.status_code == 400
    assert fragment in resp.get_json()['error']
    # nothing was written
    assert c.get('/api/user/progress', headers=head).get_json()['progress'] == {}


def test_streak_one_day_window(app):
    c, head = register_and_get_token(app, 'w1')
    today = server_today()
    base = 0
    for offset in (0, 1, -1, 2, -2):
        data = {**STREAK, 'lastDay': (today + timedelta(days=offset)).isoformat()}
        resp = c.put('/api/user/progress/streak', json={'baseVersion': base, 'data': data}, headers=head)
        expected = 200 if abs(offset) <= 1 else 400
        assert resp.status_code == expected, f'offset {offset:+d}'
        if expected == 200:
            base = resp.get_json()['version']


def test_streak_accepts_near_dates_sequentially(app):
    c, head = register_and_get_token(app, 'w2')
    today = server_today()
    base = 0
    for offset in (-1, 0, 1):
        data = {**STREAK, 'lastDay': (today + timedelta(days=offset)).isoformat()}
        resp = c.put('/api/user/progress/streak', json={'baseVersion': base, 'data': data}, headers=head)
        assert resp.status_code == 200
        base = resp.get_json()['version']


# isolation ---------------------------------------------------------------------------

def test_progress_is_per_user_isolated(app):
    _, ha = register_and_get_token(app, 'z1')
    _, hb = register_and_get_token(app, 'z2')
    client_b = app.test_client()
    assert client_b.put('/api/user/progress/terminal', json={'baseVersion': 0, 'data': {'solved': ['m1'], 'commandsRun': 3}},
                        headers=ha).status_code == 200
    rows_b = client_b.get('/api/user/progress', headers=hb).get_json()['progress']
    assert rows_b == {}
    # B cannot overwrite A's row either — versions are per-user
    assert client_b.put('/api/user/progress/terminal', json={'baseVersion': 0, 'data': {'solved': [], 'commandsRun': 0}},
                        headers=hb).status_code == 200
    rows_a = app.test_client().get('/api/user/progress', headers=ha).get_json()['progress']['terminal']
    assert rows_a['version'] == 1 and rows_a['data'] == {'solved': ['m1'], 'commandsRun': 3}


# delete-account must cascade progress rows --------------------------------------------

def test_delete_account_drops_progress(app):
    from app.models import UserProgress
    c, head = register_and_get_token(app, 'd1')
    c.put('/api/user/progress/speeddrill', json={'baseVersion': 0, 'data': {'best': 4, 'plays': 4}}, headers=head)
    assert UserProgress.query.count() == 1
    resp = c.delete('/api/user/delete-account', json={'confirm': 'userd1'}, headers=head)
    assert resp.status_code == 200
    assert UserProgress.query.count() == 0


# import: schema v1 unchanged, v2 merges progress server-side --------------------------

def test_import_v1_still_works_without_progress(app):
    c, head = register_and_get_token(app, 'i1')
    resp = c.post('/api/user/data/import', json={'version': 1, 'bookmarks': ['linux/file-and-directory/cp'], 'notes': []},
                  headers=head)
    assert resp.status_code == 200
    c.put('/api/user/progress/flashcards', json={'baseVersion': 0, 'data': {'completes': {'basics': 2}}}, headers=head)
    resp = c.post('/api/user/data/import', json={
        'version': 1,
        'bookmarks': [],
        'notes': [{'command_slug': 'linux/text-processing/grep', 'text': 'grep -r'}],
    }, headers=head)
    assert resp.status_code == 200
    rows = c.get('/api/user/progress', headers=head).get_json()['progress']
    # v1 documents carry no progress payload — existing rows must stay untouched
    assert rows['flashcards']['data'] == {'completes': {'basics': 2}} and rows['flashcards']['version'] == 1


def test_import_v2_merges_progress_server_side(app):
    c, head = register_and_get_token(app, 'i2')
    c.put('/api/user/progress/learning', json={'baseVersion': 0, 'data': LEARNING}, headers=head)
    imported_learning = {'shell-basics': {'completed': True, 'bestScore': 7, 'bestTotal': 10, 'lessons': ['0', '1']}}
    resp = c.post('/api/user/data/import', json={
        'version': 2,
        'bookmarks': ['linux/file-and-directory/cp'],
        'notes': [],
        'progress': {
            'learning': imported_learning,
            'streak': STREAK,
        },
    }, headers=head)
    assert resp.status_code == 200
    rows = c.get('/api/user/progress', headers=head).get_json()['progress']
    merged = rows['learning']['data']
    assert merged['shell-basics']['completed'] is True
    assert merged['shell-basics']['lessons'] == ['0', '1']
    assert merged['shell-basics']['bestScore'] == 7
    assert rows['learning']['version'] == 2  # bumped by the merge
    assert rows['streak']['data'] == STREAK and rows['streak']['version'] == 1


def test_import_v2_rejects_garbage_without_half_applying(app):
    c, head = register_and_get_token(app, 'i3')
    resp = c.post('/api/user/data/import', json={
        'version': 2, 'bookmarks': ['linux/file-and-directory/cp'], 'notes': [],
        'progress': {'streak': {**STREAK, 'best': -1}},
    }, headers=head)
    assert resp.status_code == 400
    assert 'Import rejected' in resp.get_json()['error']
    assert c.get('/api/user/bookmarks', headers=head).get_json()['bookmarks'] == []


def test_import_unknown_version_rejected(app):
    c, head = register_and_get_token(app, 'i4')
    resp = c.post('/api/user/data/import', json={'version': 99, 'bookmarks': [], 'notes': []}, headers=head)
    assert resp.status_code == 400 and 'unknown schema version 99' in resp.get_json()['error']
