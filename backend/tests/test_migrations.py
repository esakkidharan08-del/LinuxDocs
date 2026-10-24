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
HEAD = '004_recovery_challenges'


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

    # --- upgrade: adds user_progress + recovery challenges, rows untouched ----
    upgrade()  # head = 004_recovery_challenges (002 → 003 RLS → 004 recovery)
    assert _version_num() == HEAD
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
    assert 'user_progress' in _table_names() and _version_num() == HEAD


def test_fresh_database_full_chain(app):
    from flask_migrate import upgrade

    upgrade()  # empty file → all revisions in one go
    assert _version_num() == HEAD
    tables = _table_names()
    assert {'users', 'sessions', 'password_reset_tokens', 'bookmarks',
            'user_notes', 'recently_viewed', 'user_progress',
            'password_recovery_challenges'} <= tables


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


def test_upgrade_is_idempotent(app):
    from flask_migrate import upgrade

    upgrade()
    upgrade()  # second run: already at head, must be a no-op
    assert _version_num() == HEAD


def test_downgrade_chain_to_base_and_replay(app):
    """Downgrade all the way to base, then rebuild — the full round trip."""
    from flask_migrate import downgrade, upgrade

    upgrade()
    downgrade(revision='base')
    assert _version_num() is None
    # only alembic's own version table survives; app tables are all dropped
    assert _table_names() == {'alembic_version'}
    upgrade()
    assert _version_num() == HEAD
    assert {'users', 'user_progress'} <= _table_names()


class TestRlsLockdown:
    """The 003+004 migrations guard the Supabase Data API surface."""

    def test_app_table_list_matches_models(self):
        """APP_TABLES must stay in lockstep with the ORM's tables."""
        import importlib.util
        from pathlib import Path
        from app.models import db

        versions = Path(__file__).resolve().parents[1] / 'migrations' / 'versions'
        app_tables = set()
        for name, ident in (('003_rls_lockdown.py', 'rls_migration_003'),
                            ('004_recovery_challenges.py', 'recovery_migration_004')):
            path = versions / name
            spec = importlib.util.spec_from_file_location(ident, path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            app_tables |= set(module.APP_TABLES)
        assert app_tables == set(db.metadata.tables.keys())

    def test_rls_migration_is_a_noop_on_sqlite(self, app):
        """SQLite has no RLS: the chain must complete and tables stay usable."""
        from flask_migrate import upgrade
        from app.models import User

        upgrade()  # → 004 on sqlite = create tables, RLS parts skipped
        assert _version_num() == HEAD

        user = User(username='rlsnoop', email='rlsnoop@example.com')
        user.set_password('Password-rlsnoop9!')
        db.session.add(user)
        db.session.commit()
        assert db.session.query(User).count() == 1


class TestCreateAllPolicy:
    """create_all() only for the sqlite dev fallback; migrations own Postgres."""

    def test_postgres_never_create_all(self, monkeypatch, tmp_path):
        from app import create_app, db
        monkeypatch.setenv('DATABASE_URL',
                           'postgres://u:p@db.ref.supabase.co:5432/db')
        monkeypatch.delenv('SKIP_DB_CREATE_ALL', raising=False)
        seen = []
        monkeypatch.setattr(db, 'create_all',
                            lambda *a, **k: seen.append('called'))
        create_app()
        assert seen == []  # schema comes from `flask db upgrade` only

    def test_sqlite_dev_still_create_all(self, monkeypatch, tmp_path):
        from app import create_app, db
        monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path / "pol.sqlite3"}')
        monkeypatch.delenv('SKIP_DB_CREATE_ALL', raising=False)
        seen = []
        monkeypatch.setattr(db, 'create_all',
                            lambda *a, **k: seen.append('called'))
        create_app()
        assert seen == ['called']

    def test_skip_flag_disables_sqlite_create_all(self, monkeypatch, tmp_path):
        from app import create_app, db
        monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path / "pol2.sqlite3"}')
        monkeypatch.setenv('SKIP_DB_CREATE_ALL', '1')
        seen = []
        monkeypatch.setattr(db, 'create_all',
                            lambda *a, **k: seen.append('called'))
        create_app()
        assert seen == []
