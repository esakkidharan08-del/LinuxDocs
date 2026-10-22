"""Alembic migration chain tests (Part 2) — upgrade AND downgrade.

Runs the real hand-written chain (001_initial → 002_user_progress) against a
throwaway SQLite file via Flask-Migrate programmatic API. Two flows are
covered exactly the way they will happen in the wild:

* an EXISTING database stamped at ``001_initial`` (the pre-Part-2 production
  schema) upgrades to add ``user_progress`` without touching existing rows,
  and downgrades back cleanly;
* a FRESH database builds the full chain from scratch in one upgrade.

The production ``backend/instance/app.db`` is never touched here.
"""

import pytest

from app import create_app, db

FIRST = '001_initial'


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('SECRET_KEY', 'test-secret-key-for-testing-only')
    monkeypatch.setenv('JWT_SECRET_KEY', 'test-jwt-secret-key-for-testing-only')
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path / "mig.sqlite3"}')
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:5173')
    monkeypatch.setenv('SKIP_DB_CREATE_ALL', '1')  # migrations own the schema here

    application = create_app()
    application.config['TESTING'] = True
    with application.app_context():
        yield application


def _version_num():
    from sqlalchemy import text
    return db.session.execute(text('SELECT version_num FROM alembic_version')).scalar()


def _table_names():
    from sqlalchemy import inspect
    return set(inspect(db.engine).get_table_names())


def test_existing_database_upgrade_and_downgrade(app):
    from flask_migrate import downgrade, upgrade
    from app.models import User

    # --- become a pre-Part-2 database: initial schema only, with real data ---
    # (an empty tmp file upgraded to 001_initial IS the pre-Part-2 schema)
    upgrade(revision=FIRST)
    assert _version_num() == FIRST
    assert 'user_progress' not in _table_names()

    user = User(username='existing', email='existing@example.com')
    user.set_password('Password-existing90!')
    db.session.add(user)
    db.session.commit()
    user_id = user.id

    # --- upgrade: adds user_progress, existing rows untouched ------------------
    upgrade()  # head = 002_user_progress
    assert _version_num() == '002_user_progress'
    assert 'user_progress' in _table_names()
    assert db.session.get(User, user_id) is not None

    # unique (user_id, key) is enforced through the migration-created table
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError
    db.session.execute(text(
        "INSERT INTO user_progress (user_id, key, version, data, updated_at) "
        f"VALUES ({user_id}, 'streak', 1, '{{}}', CURRENT_TIMESTAMP)"))
    db.session.commit()
    with pytest.raises(IntegrityError):
        db.session.execute(text(
            "INSERT INTO user_progress (user_id, key, version, data, updated_at) "
            f"VALUES ({user_id}, 'streak', 2, '{{}}', CURRENT_TIMESTAMP)"))
    db.session.rollback()

    # --- downgrade: drops user_progress, keeps everyone else -------------------
    downgrade(revision=FIRST)
    assert 'user_progress' not in _table_names()
    assert _version_num() == FIRST
    assert {'users', 'sessions', 'bookmarks', 'user_notes', 'recently_viewed'} <= _table_names()
    assert db.session.get(User, user_id) is not None

    # and the chain can be replayed forward again
    upgrade()
    assert 'user_progress' in _table_names() and _version_num() == '002_user_progress'


def test_fresh_database_full_chain(app):
    from flask_migrate import upgrade

    upgrade()  # empty file → both revisions in one go
    assert _version_num() == '002_user_progress'
    tables = _table_names()
    assert {'users', 'sessions', 'password_reset_tokens', 'bookmarks',
            'user_notes', 'recently_viewed', 'user_progress'} <= tables


def test_orm_map_matches_migrated_table(app):
    """The ORM must read/write the migrated table (no schema drift)."""
    from flask_migrate import upgrade
    from app.models import UserProgress, User

    upgrade()
    user = User(username='ormcheck', email='ormcheck@example.com')
    user.set_password('Password-ormcheck9!')
    db.session.add(user)
    db.session.commit()
    db.session.add(UserProgress(user_id=user.id, key='terminal', version=3,
                                data={'solved': ['m1'], 'commandsRun': 12}))
    db.session.commit()
    row = db.session.query(UserProgress).filter_by(user_id=user.id, key='terminal').one()
    assert row.version == 3 and row.data['solved'] == ['m1']
