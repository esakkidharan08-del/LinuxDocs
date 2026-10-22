"""Catalog/command content endpoints — Part 1 auth and delivery contract.

Nobody reads command documentation without an account:
  - unauthenticated requests to every catalog/commands endpoint answer 401
  - authed clients get the light index (metadata only) and per-slug full docs
  - repeat loads revalidate via ETag (304) with Cache-Control: private, no-cache
"""

import pytest
import json
import re
from pathlib import Path
from app import create_app
from app import db
from app.models import User

DATA_PATH = Path(__file__).resolve().parent.parent / "data"

LIGHT_FIELDS = {"slug", "name", "summary", "tags", "category", "section"}


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
def auth_headers(app):
    with app.app_context():
        user = User(username='datasetuser', email='dataset@example.com')
        user.set_password('TestPass123!')
        db.session.add(user)
        db.session.commit()
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(user.id))
        return {'Authorization': f'Bearer {token}'}


# ------------------------------------------------------------------ auth gate

def test_catalog_index_requires_auth(client):
    resp = client.get('/api/catalog/index')
    assert resp.status_code == 401


def test_command_detail_requires_auth(client):
    resp = client.get('/api/commands/grep')
    assert resp.status_code == 401


def test_command_detail_rejects_bogus_token(client):
    resp = client.get('/api/commands/grep', headers={'Authorization': 'Bearer not-a-token'})
    assert resp.status_code == 422 or resp.status_code == 401


# --------------------------------------------------------------- index shape

def test_catalog_index_shape(client, auth_headers):
    resp = client.get('/api/catalog/index', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert set(data.keys()) == {'categories', 'domains', 'counts', 'commands'}

    aggregate = json.loads((DATA_PATH / 'commands.json').read_text(encoding='utf-8'))
    assert len(data['commands']) == len(aggregate['commands']) == 132
    for light in data['commands']:
        assert set(light.keys()) == LIGHT_FIELDS, light['slug']
        assert '@' not in json.dumps(light)  # no leaked emails/etc. sanity
    assert {c['id'] for c in data['categories']} == {c['id'] for c in aggregate['categories']}
    assert {d['id'] for d in data['domains']} == {d['id'] for d in aggregate['domains']}

    counts = data['counts']
    assert len(counts) == len({c['category'] for c in aggregate['commands']})
    for cat_id, count in counts.items():
        assert count == sum(1 for c in aggregate['commands'] if c['category'] == cat_id)

    # The light index must not carry any documentation content beyond the five
    # metadata fields: no syntax, options, examples, related, description, etc.
    forbidden = {'syntax', 'options', 'examples', 'related', 'description', 'warnings', 'useCases'}
    for light in data['commands']:
        assert not (set(light.keys()) & forbidden), light['slug']


# ------------------------------------------------------------- command detail

def test_command_detail_full_content(client, auth_headers):
    aggregate = json.loads((DATA_PATH / 'commands.json').read_text(encoding='utf-8'))
    want = next(c for c in aggregate['commands'] if c['slug'] == 'grep')
    resp = client.get('/api/commands/grep', headers=auth_headers)
    assert resp.status_code == 200
    command = resp.get_json()['command']
    assert command == want  # full doc, byte-for-byte field-equal with the aggregate


def test_command_detail_unknown_slug(client, auth_headers):
    resp = client.get('/api/commands/not-a-real-slug', headers=auth_headers)
    assert resp.status_code == 404


# ------------------------------------------------- ETag / Cache-Control rules

def test_etag_roundtrip_cache_headers(client, auth_headers):
    resp = client.get('/api/catalog/index', headers=auth_headers)
    assert resp.status_code == 200
    cache_control = resp.headers.get('Cache-Control', '')
    assert cache_control == 'private, no-cache'
    etag = resp.headers.get('ETag', '')
    assert re.fullmatch(r'"[0-9a-f]{32}"', etag)

    revalidated = client.get('/api/catalog/index',
                             headers={**auth_headers, 'If-None-Match': etag})
    assert revalidated.status_code == 304
    assert not revalidated.get_data()  # 304 carries no payload
    assert revalidated.headers.get('ETag') == etag

    stale = client.get('/api/catalog/index', headers={**auth_headers, 'If-None-Match': '"00000000000000000000000000000000"'})
    assert stale.status_code == 200
    assert stale.headers.get('ETag') == etag


def test_command_detail_etag_covers_only_that_slug(client, auth_headers):
    first = client.get('/api/commands/grep', headers=auth_headers)
    second = client.get('/api/commands/sed', headers=auth_headers)
    assert first.headers.get('ETag') != second.headers.get('ETag')
    revalidated = client.get('/api/commands/grep',
                             headers={**auth_headers, 'If-None-Match': first.headers.get('ETag')})
    assert revalidated.status_code == 304
