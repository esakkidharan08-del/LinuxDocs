"""Knowledge-quiz password recovery (recovery.py) — endpoint tests.

Covers: direct mode for empty accounts, challenge mode for learners with
real progress data, grading (8/10 pass mark), attempt burning, grant
expiry + single-use semantics, no answer leakage in the API responses,
and the full reset round-trip (old password dies, new password works).
"""

import pytest

from app import create_app, db
from app.models import PasswordRecoveryChallenge
from app.security import sha256_hex
from app.progress_schemas import server_today


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('SECRET_KEY', 'test-secret-key-for-testing-only')
    monkeypatch.setenv('JWT_SECRET_KEY', 'test-jwt-secret-key-for-testing-only')
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///:memory:')
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:5173')
    monkeypatch.delenv('RATE_LIMIT_ENABLED', raising=False)

    application = create_app()
    application.config['TESTING'] = True
    with application.app_context():
        db.create_all()
        yield application
        db.drop_all()


def _register(app, suffix):
    c = app.test_client()
    resp = c.post('/api/auth/register', json={
        'username': f'learner{suffix}', 'email': f'learner{suffix}@example.com',
        'password': f'OrigPass-{suffix}90!', 'confirm_password': f'OrigPass-{suffix}90!'})
    assert resp.status_code == 201
    token = resp.get_json()['access_token']
    return c, {'Authorization': f'Bearer {token}'}


def _seed_learner(c, head, suffix):
    """Give the account enough real activity for 10+ well-defined facts."""
    learning_data: dict = {}
    base = 0
    blueprint = {
        'shell-basics': {'completed': True, 'bestScore': 4, 'bestTotal': 5, 'lessons': ['0', '1', '2']},
        'text-tools': {'completed': False, 'bestScore': 0, 'bestTotal': 0, 'lessons': ['0', '1']},
        'system-networking': {'completed': False, 'bestScore': 0, 'bestTotal': 0, 'lessons': ['0', '1']},
        'security-ctf': {'completed': False, 'bestScore': 0, 'bestTotal': 0, 'lessons': ['0', '1']},
    }
    for path, body in blueprint.items():
        learning_data[path] = body
        resp = c.put('/api/user/progress/learning', json={'baseVersion': base, 'data': learning_data},
                     headers=head)
        assert resp.status_code == 200, resp.get_json()
        base = resp.get_json()['version']
    for key, data in [
        ('speeddrill', {'best': 12, 'plays': 5}),
        ('terminal', {'solved': ['m1', 'm2', 'm3'], 'commandsRun': 9}),
        ('streak', {'lastDay': server_today().isoformat(), 'current': 3, 'best': 6, 'totalDays': 11}),
        ('flashcards', {'completes': {'basics': 2, 'linux:text-tools': 1}}),
    ]:
        resp = c.put(f'/api/user/progress/{key}', json={'baseVersion': 0, 'data': data}, headers=head)
        assert resp.status_code == 200, resp.get_json()
    for slug in ['linux/file-and-directory/cp', 'linux/file-and-directory/mv', 'linux/text-processing/grep']:
        resp = c.post('/api/user/bookmarks/toggle', json={'command_slug': slug}, headers=head)
        assert resp.status_code in (200, 201), resp.get_json()
    resp = c.post('/api/user/history/add', json={'command_slug': 'linux/system-services/journalctl'},
                  headers=head)
    assert resp.status_code in (200, 201)


def _start(app, email):
    return app.test_client().post('/api/auth/recovery/start', json={'email': email})


def _row(app, grant, email_suffix):
    with app.app_context():
        return PasswordRecoveryChallenge.query.filter_by(
            challenge_hash=sha256_hex(grant)).first()


# ---------------------------------------------------------------------------
# start
# ---------------------------------------------------------------------------

def test_unknown_email_is_unavailable(app):
    body = _start(app, 'nobody@example.com').get_json()
    assert body['mode'] == 'unavailable'


def test_fresh_account_skips_the_quiz_direct_mode(app):
    _register(app, 'fresh')
    resp = _start(app, 'learnerfresh@example.com')
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['mode'] == 'direct' and body['questions'] is None

    # direct grant completes without any quiz round-trip
    done = app.test_client().post('/api/auth/recovery/complete', json={
        'grant': body['grant'], 'password': 'Brand!New123', 'confirm_password': 'Brand!New123'})
    assert done.status_code == 200
    login = app.test_client().post('/api/auth/login', json={
        'email': 'learnerfresh@example.com', 'password': 'Brand!New123'})
    assert login.status_code == 200
    old = app.test_client().post('/api/auth/login', json={
        'email': 'learnerfresh@example.com', 'password': 'OrigPass-fresh90!'})
    assert old.status_code == 401


def test_complete_is_single_use(app):
    _register(app, 'once')
    body = _start(app, 'learneronce@example.com').get_json()
    client = app.test_client()
    first = client.post('/api/auth/recovery/complete', json={
        'grant': body['grant'], 'password': 'Second!Pass99', 'confirm_password': 'Second!Pass99'})
    assert first.status_code == 200
    second = client.post('/api/auth/recovery/complete', json={
        'grant': body['grant'], 'password': 'Third!Pass88', 'confirm_password': 'Third!Pass88'})
    assert second.status_code == 400


def test_challenger_gets_ten_answerless_questions(app):
    c, head = _register(app, 'q')
    _seed_learner(c, head, 'q')
    resp = _start(app, 'learnerq@example.com')
    body = resp.get_json()
    assert body['mode'] == 'challenge'
    questions = body['questions']
    assert len(questions) == 10
    for question in questions:
        assert len(question['options']) == 4
        assert len(set(question['options'])) == 4        # no duplicate options
        assert 'correct' not in question                 # answers never leak


def test_full_challenge_roundtrip(app):
    c, head = _register(app, 'full')
    _seed_learner(c, head, 'full')
    client = app.test_client()
    body = _start(app, 'learnerfull@example.com').get_json()
    assert body['mode'] == 'challenge'

    row = _row(app, body['grant'], 'full')
    assert row is not None and row.mode == 'challenge'
    correct = [q['correct'] for q in row.questions]

    verify = client.post('/api/auth/recovery/verify', json={'grant': body['grant'], 'answers': correct})
    assert verify.status_code == 200 and verify.get_json() == {'passed': True}

    weak = client.post('/api/auth/recovery/complete', json={
        'grant': body['grant'], 'password': 'short', 'confirm_password': 'short'})
    assert weak.status_code == 400                       # typo does NOT burn the grant

    done = client.post('/api/auth/recovery/complete', json={
        'grant': body['grant'], 'password': 'Newest!Pass11', 'confirm_password': 'Newest!Pass11'})
    assert done.status_code == 200
    assert client.post('/api/auth/login', json={
        'email': 'learnerfull@example.com', 'password': 'Newest!Pass11'}).status_code == 200
    assert client.post('/api/auth/login', json={
        'email': 'learnerfull@example.com', 'password': 'OrigPass-full90!'}).status_code == 401


def test_password_with_own_email_rejected_before_grant_spent(app):
    c, head = _register(app, 'ident')
    _seed_learner(c, head, 'ident')
    client = app.test_client()
    body = _start(app, 'learnerident@example.com').get_json()
    row = _row(app, body['grant'], 'ident')
    correct = [q['correct'] for q in row.questions]
    client.post('/api/auth/recovery/verify', json={'grant': body['grant'], 'answers': correct})

    resp = client.post('/api/auth/recovery/complete', json={
        'grant': body['grant'],
        'password': f'learnerident123!Aa', 'confirm_password': f'learnerident123!Aa'})
    assert resp.status_code == 400
    # grant still spendable with a clean password
    ok = client.post('/api/auth/recovery/complete', json={
        'grant': body['grant'], 'password': 'Clean!Pass77', 'confirm_password': 'Clean!Pass77'})
    assert ok.status_code == 200


def test_three_wrong_bundles_burn_the_grant(app):
    c, head = _register(app, 'burn')
    _seed_learner(c, head, 'burn')
    client = app.test_client()
    body = _start(app, 'learnerburn@example.com').get_json()
    grant = body['grant']

    first = client.post('/api/auth/recovery/verify', json={'grant': grant, 'answers': [0, 1, 2, 3] * 2 + [0, 1]})
    assert first.get_json() == {'passed': False, 'correct': first.get_json()['correct'], 'attemptsLeft': 2}
    second = client.post('/api/auth/recovery/verify', json={'grant': grant, 'answers': [3, 2, 1, 0] * 2 + [1, 0]})
    assert second.get_json()['attemptsLeft'] == 1
    third = client.post('/api/auth/recovery/verify', json={'grant': grant, 'answers': [1, 1, 1, 1] * 2 + [2, 2]})
    assert third.get_json() == {'passed': False, 'burned': True}

    assert client.post('/api/auth/recovery/verify', json={'grant': grant, 'answers': [0] * 10}).status_code == 400
    assert client.post('/api/auth/recovery/complete', json={
        'grant': grant, 'password': 'Whatever!999', 'confirm_password': 'Whatever!999'}).status_code == 400


def test_malformed_answers_rejected(app):
    c, head = _register(app, 'bad')
    _seed_learner(c, head, 'bad')
    body = _start(app, 'learnerbad@example.com').get_json()
    grant = body['grant']
    client = app.test_client()
    assert client.post('/api/auth/recovery/verify', json={'grant': grant}).status_code == 400
    assert client.post('/api/auth/recovery/verify', json={'grant': grant, 'answers': [0]}).status_code == 400
    assert client.post('/api/auth/recovery/verify',
                       json={'grant': grant, 'answers': [0] * 9 + ['x']}).status_code == 400
    # malformed submissions do not consume attempts (schema-level rejection)
    row = _row(app, grant, 'bad')
    assert row.attempts == 0


def test_new_start_invalidates_outstanding_grant(app):
    c, head = _register(app, 'newstart')
    _seed_learner(c, head, 'newstart')
    client = app.test_client()
    first = _start(app, 'learnernewstart@example.com').get_json()
    second = _start(app, 'learnernewstart@example.com').get_json()
    assert first['grant'] != second['grant']
    stale = client.post('/api/auth/recovery/verify',
                        json={'grant': first['grant'], 'answers': [0] * 10})
    assert stale.status_code == 400


def test_expired_grant_is_invalid(app):
    c, head = _register(app, 'exp')
    _seed_learner(c, head, 'exp')
    body = _start(app, 'learnerexp@example.com').get_json()
    with app.app_context():
        row = PasswordRecoveryChallenge.query.filter_by(challenge_hash=sha256_hex(body['grant'])).first()
        from datetime import datetime, timezone
        row.expires_at = datetime.now(timezone.utc)
        db.session.commit()
    client = app.test_client()
    assert client.post('/api/auth/recovery/verify',
                       json={'grant': body['grant'], 'answers': [0] * 10}).status_code == 400
    assert client.post('/api/auth/recovery/complete', json={
        'grant': body['grant'], 'password': 'Expired!Pass1', 'confirm_password': 'Expired!Pass1'}).status_code == 400


def test_random_grant_string_is_invalid(app):
    client = app.test_client()
    assert client.post('/api/auth/recovery/verify',
                       json={'grant': 'f' * 32, 'answers': [0] * 10}).status_code == 400
    assert client.post('/api/auth/recovery/complete', json={
        'grant': 'f' * 32, 'password': 'NoChance!11', 'confirm_password': 'NoChance!11'}).status_code == 400
