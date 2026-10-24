"""Tests for /api/ready and the paused-database (503) error path (Step 4)."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.exc import DisconnectionError, OperationalError  # noqa: E402

from app import create_app  # noqa: E402


class _BoomEngine:
    """Fake engine whose every connect fails (simulated DB down)."""

    def connect(self):
        raise DisconnectionError('simulated: database is down')


def _swap_engine(app, monkeypatch, engine):
    # Flask-SQLAlchemy's .engines property requires an app context, but the
    # modified dict lives on the extension object and survives the block.
    with app.app_context():
        monkeypatch.setitem(app.extensions['sqlalchemy'].engines, None, engine)


class TestReadyEndpoint:
    def _app(self):
        return create_app()

    def test_ready_ok_reports_latency_and_mode(self):
        app = self._app()
        client = app.test_client()
        res = client.get('/api/ready')
        assert res.status_code == 200
        body = res.get_json()
        assert body['status'] == 'ok'
        assert body['database'] == 'ready'
        assert isinstance(body['latency_ms'], int) and body['latency_ms'] >= 0
        assert body['mode'] == app.config['DB_MODE']
        # strict shape: no secrets or internals leak out
        assert set(body) == {'status', 'database', 'latency_ms', 'mode'}

    def test_health_stays_a_cheap_liveness_check(self):
        app = self._app()
        client = app.test_client()
        res = client.get('/api/health')
        assert res.status_code == 200
        assert res.get_json() == {'status': 'ok'}

    def test_ready_503_when_database_unreachable(self, monkeypatch):
        app = self._app()
        _swap_engine(app, monkeypatch, _BoomEngine())
        client = app.test_client()
        res = client.get('/api/ready')
        assert res.status_code == 503
        body = res.get_json()
        assert 'not ready' in body['error']
        assert isinstance(body['request_id'], str) and len(body['request_id']) >= 8
        # correlation header is set even on the failure path
        assert res.headers.get('X-Request-ID') == body['request_id']
        # strict shape on failure too
        assert set(body) == {'error', 'request_id'}

    def test_ready_accepts_client_request_id_for_correlation(self, monkeypatch):
        app = self._app()
        _swap_engine(app, monkeypatch, _BoomEngine())
        client = app.test_client()
        res = client.get('/api/ready', headers={'X-Request-ID': 'probe-42'})
        assert res.status_code == 503
        assert res.get_json()['request_id'] == 'probe-42'
        assert res.headers.get('X-Request-ID') == 'probe-42'


class TestDatabaseDownIsNotA500:
    """Paused managed DB inside any view → 503, generic errors stay 500."""

    def _app_with_probe_routes(self):
        app = create_app()

        @app.route('/api/_probe-db-boom')
        def db_boom():
            conn = app.extensions['sqlalchemy'].engines[None].connect()
            raise OperationalError('SELECT 1', {}, Exception('db gone'))

        @app.route('/api/_probe-boom')
        def plain_boom():
            raise RuntimeError('regular application bug')

        return app

    def test_operational_error_becomes_503(self):
        app = self._app_with_probe_routes()
        res = app.test_client().get('/api/_probe-db-boom')
        assert res.status_code == 503
        body = res.get_json()
        assert 'not ready' in body['error']
        assert body['request_id']

    def test_plain_exception_stays_500(self):
        app = self._app_with_probe_routes()
        res = app.test_client().get('/api/_probe-boom')
        assert res.status_code == 500
        assert res.get_json() == {'error': 'Internal server error'}

    def test_no_stack_trace_and_no_dsn_in_any_error_body(self):
        app = self._app_with_probe_routes()
        client = app.test_client()
        for path in ('/api/_probe-db-boom', '/api/_probe-boom'):
            res = client.get(path)
            text = res.get_data(as_text=True)
            assert 'Traceback' not in text
            assert 'DATABASE_URL' not in text
            assert 'psycopg' not in text
