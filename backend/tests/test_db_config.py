"""Unit tests for app/db.py — Supabase Postgres connection policy."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest  # noqa: E402

from app.database import (  # noqa: E402
    DatabaseUrlError, connection_mode, is_postgres, log_line,
    normalize_database_url, postgres_engine_options, _make_connect,
)


# --- URL normalization -------------------------------------------------------

class TestNormalizeDatabaseUrl:
    def test_postgres_scheme_becomes_psycopg3(self):
        # localhost input isolates the scheme conversion from the sslmode rule
        out = normalize_database_url('postgres://u:p@localhost/dbname')
        assert out == 'postgresql+psycopg://u:p@localhost/dbname'

    def test_postgresql_scheme_becomes_psycopg3(self):
        out = normalize_database_url('postgresql://u:p@localhost/dbname')
        assert out == 'postgresql+psycopg://u:p@localhost/dbname'

    def test_psycopg2_dialect_is_upgraded(self):
        out = normalize_database_url('postgresql+psycopg2://u:p@localhost/db')
        assert out == 'postgresql+psycopg://u:p@localhost/db'

    def test_psycopg_dialect_is_idempotent(self):
        out = normalize_database_url('postgresql+psycopg://u:p@localhost/db')
        assert out == 'postgresql+psycopg://u:p@localhost/db'

    def test_sqlite_passthrough(self):
        uri = 'sqlite:///instance/app.db'
        assert normalize_database_url(uri) == uri

    def test_empty_passthrough(self):
        assert normalize_database_url(None) is None
        assert normalize_database_url('') == ''  # type: ignore[arg-type]

    def test_remote_host_gains_sslmode_require(self):
        out = normalize_database_url('postgres://u:p@db.abc.supabase.co:5432/db')
        assert 'sslmode=require' in out

    def test_localhost_does_not_gain_sslmode(self):
        # bare '::1' cannot be parsed by make_url (bracketed form needed);
        # real local development always uses the sqlite fallback,listed above.
        for host in ('localhost', '127.0.0.1'):
            out = normalize_database_url(f'postgres://u:p@{host}/db')
            assert 'sslmode' not in out, host

    def test_existing_sslmode_not_overwritten(self):
        out = normalize_database_url(
            'postgres://u:p@db.abc.supabase.co/db?sslmode=verify-full')
        assert out.count('sslmode') == 1
        assert 'sslmode=verify-full' in out

    def test_quoted_password_round_trips(self):
        out = normalize_database_url('postgres://user:p%40ss@h.example/db')
        # render re-encodes safely; make_url decodes back to the real value
        assert 'p%40ss' in out and 'p@ss' not in out
        from sqlalchemy.engine import make_url
        assert make_url(out).password == 'p@ss'

    def test_malformed_url_raises_without_echo(self):
        bad = 'postgres://user:p@h.example:notaport/db'
        with pytest.raises(DatabaseUrlError) as excinfo:
            normalize_database_url(bad)
        # the raw URL (contains the password) must never appear in the message
        assert bad not in str(excinfo.value)
        assert 'DATABASE_URL' in str(excinfo.value)


# --- connection-mode detection ------------------------------------------------

class TestConnectionMode:
    def test_transaction_pooler_port_6543(self):
        uri = 'postgresql+psycopg://u:p@aws-0-ap.pooler.supabase.com:6543/db'
        assert connection_mode(uri) == 'transaction'

    def test_session_pooler_host(self):
        uri = 'postgresql+psycopg://u:p@aws-0-ap.pooler.supabase.com:5432/db'
        assert connection_mode(uri) == 'session'

    def test_pooler_user_form_session(self):
        uri = 'postgresql+psycopg://postgres.ref:pw@aws-0-ap.pooler.supabase.com/db'
        assert connection_mode(uri) == 'session'

    def test_direct_host(self):
        uri = 'postgresql+psycopg://u:p@db.ref.supabase.co/db'
        assert connection_mode(uri) == 'direct'

    def test_default_port_is_5432(self):
        uri = 'postgresql+psycopg://u:p@aws-0-ap.pooler.supabase.com/db'
        assert connection_mode(uri) == 'session'

    def test_db_pool_mode_override_wins(self, monkeypatch):
        monkeypatch.setenv('DB_POOL_MODE', 'transaction')
        uri = 'postgresql+psycopg://u:p@db.ref.supabase.co/db'
        assert connection_mode(uri) == 'transaction'

    def test_db_pool_mode_session_on_direct(self, monkeypatch):
        monkeypatch.setenv('DB_POOL_MODE', 'session')
        uri = 'postgresql+psycopg://u:p@db.ref.supabase.co/db'
        assert connection_mode(uri) == 'session'

    def test_unknown_override_ignored(self, monkeypatch):
        monkeypatch.setenv('DB_POOL_MODE', 'pooled-ish')
        uri = 'postgresql+psycopg://u:p@db.ref.supabase.co/db'
        assert connection_mode(uri) == 'direct'


# --- startup log line ----------------------------------------------------------

class TestLogLine:
    POSTGRES = 'postgres://user:secretpw@aws-0-ap.pooler.supabase.com:5432/db'

    def test_postgres_line_without_credentials(self):
        line = log_line(normalize_database_url(self.POSTGRES))
        assert line.startswith('database: postgres host=aws-0-ap.pooler.supabase.com port=5432 mode=')
        assert 'secretpw' not in line

    def test_sqlite_line(self):
        assert log_line('sqlite:///db.sqlite') == 'database: sqlite (local dev)'

    def test_none_is_sqlite_line(self):
        assert log_line(None) == 'database: sqlite (local dev)'


# --- engine options + creator ---------------------------------------------------

class TestEngineOptions:
    def test_shape(self):
        opts = postgres_engine_options(
            'postgresql+psycopg://u:p@aws-0-ap.pooler.supabase.com:5432/db')
        assert opts['pool_pre_ping'] is True
        assert opts['pool_size'] == 3
        assert opts['max_overflow'] == 2
        assert opts['pool_recycle'] == 300
        assert opts['pool_timeout'] == 10
        assert callable(opts['creator'])


class TestCreator:
    def test_dsn_and_connect_timeout_passed(self, monkeypatch):
        calls = {}

        def fake_psycopg_connect(dsn, **kwargs):
            calls['dsn'] = dsn
            calls['kwargs'] = kwargs
            from unittest.mock import MagicMock
            return MagicMock()

        import psycopg
        monkeypatch.setattr(psycopg, 'connect', fake_psycopg_connect)
        uri = normalize_database_url('postgres://u:p@db.ref.supabase.co/db?sslmode=require')
        _make_connect(uri, 'direct')()
        assert calls['dsn'].startswith('postgresql://u:p@db.ref.supabase.co/db')
        assert '_checking' not in calls['dsn']
        assert calls['kwargs'] == {'connect_timeout': 10}

    def test_transaction_mode_disables_prepared_statements(self, monkeypatch):
        captured = {}

        class FakeConn:
            pass

        def fake_psycopg_connect(dsn, **kwargs):
            captured['dsn'] = dsn
            return FakeConn()

        import psycopg
        monkeypatch.setattr(psycopg, 'connect', fake_psycopg_connect)
        uri = normalize_database_url(
            'postgres://u:p@aws-0-ap.pooler.supabase.com:6543/db')
        conn = _make_connect(uri, 'transaction')()
        assert captured['dsn'].startswith('postgresql://u:p@aws-0-ap.pooler.supabase.com:6543/db')
        assert conn.prepare_threshold is None

    def test_retries_until_success(self, monkeypatch):
        attempts = {'n': 0}

        def flaky(dsn, **kwargs):
            attempts['n'] += 1
            if attempts['n'] < 3:
                raise OSError('simulated wake-up')
            from unittest.mock import MagicMock
            return MagicMock()

        import psycopg
        monkeypatch.setattr(psycopg, 'connect', flaky)
        monkeypatch.setenv('DB_CONNECT_BACKOFF', '0')  # keep the test fast
        conn = _make_connect(
            'postgresql+psycopg://u:p@db.ref.supabase.co/db', 'direct')()
        assert attempts['n'] == 3
        assert conn is not None

    def test_gives_up_after_retries_and_raises_last(self, monkeypatch):
        attempts = {'n': 0}

        def always_down(dsn, **kwargs):
            attempts['n'] += 1
            raise OSError('simulated outage')

        import psycopg
        monkeypatch.setattr(psycopg, 'connect', always_down)
        monkeypatch.setenv('DB_CONNECT_RETRIES', '2')
        monkeypatch.setenv('DB_CONNECT_BACKOFF', '0')
        with pytest.raises(OSError):
            _make_connect(
                'postgresql+psycopg://u:p@db.ref.supabase.co/db', 'direct')()
        assert attempts['n'] == 2

    def test_bad_env_ints_fall_back(self, monkeypatch):
        # A non-integer DB_CONNECT_TIMEOUT must not crash startup.
        monkeypatch.setenv('DB_CONNECT_TIMEOUT', 'ten')
        seen = {}

        def fake(dsn, **kwargs):
            seen.update(kwargs)
            from unittest.mock import MagicMock
            return MagicMock()

        import psycopg
        monkeypatch.setattr(psycopg, 'connect', fake)
        _make_connect(
            'postgresql+psycopg://u:p@db.ref.supabase.co/db', 'direct')()
        assert seen == {'connect_timeout': 10}


# --- create_app integration ------------------------------------------------------

class TestCreateAppIntegration:
    def test_sqlite_app_logs_dev_line(self):
        from app import create_app
        app = create_app()
        assert app.config['DB_MODE'] == 'sqlite'
        assert app.config['SQLALCHEMY_DATABASE_URI'] == \
            os.environ['DATABASE_URL']

    def test_postgres_app_normalizes_and_labels_mode(self, monkeypatch):
        from app import create_app
        monkeypatch.setenv('DATABASE_URL',
                           'postgres://u:p@aws-0-ap.pooler.supabase.com:5432/db?q=1')
        # create_all must not try to connect to the fake host; step 2 removes
        # it entirely for non-sqlite URIs. Here we only check configuration.
        monkeypatch.setenv('SKIP_DB_CREATE_ALL', '1')
        app = create_app()
        conf = app.config['SQLALCHEMY_DATABASE_URI']
        assert conf.startswith('postgresql+psycopg://u:p@aws-0-ap.pooler.supabase.com:5432/db')
        assert 'sslmode=require' in conf
        assert app.config['DB_MODE'] == 'session'
        opts = app.config['SQLALCHEMY_ENGINE_OPTIONS']
        assert opts['pool_size'] == 3 and callable(opts['creator'])

    def test_postgres_transaction_mode_6543(self, monkeypatch):
        from app import create_app
        monkeypatch.setenv('DATABASE_URL',
                           'postgres://u:p@aws-0-ap.pooler.supabase.com:6543/db')
        monkeypatch.setenv('SKIP_DB_CREATE_ALL', '1')
        app = create_app()
        assert app.config['DB_MODE'] == 'transaction'



