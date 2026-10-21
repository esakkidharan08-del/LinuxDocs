"""Durable, self-healing database persistence for LinuxDocs.

The contract this module keeps: **registered users are remembered forever.**

Failure modes it defends against, and how:

===============================  ============================================
Failure                          Counter-measure
===============================  ============================================
Power loss / Ctrl+C mid-write    ``journal_mode=WAL`` + ``synchronous=FULL``
Silent referential corruption    ``foreign_keys=ON`` (SQLite defaults to OFF)
Writes dropped under load        ``busy_timeout`` (wait instead of failing)
Database corruption              boot-time ``integrity_check`` + auto-restore
Accidental deletion / rollback   verified hot backups, rotated on disk
Unbounded table growth           periodic pruning of stale rows
===============================  ============================================

All tuning is environment-driven (see ``.env.example``), and every operation
degrades to a no-op for in-memory databases so the test suite is untouched.
"""

from __future__ import annotations

import atexit
import logging
import os
import shutil
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import event

from .security import env_int

log = logging.getLogger('linuxdocs.security')


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes', 'on')


def _open_readonly(path: Path) -> sqlite3.Connection:
    """Open a SQLite file read-only so maintenance code can never mutate it."""
    try:
        return sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True, timeout=30)
    except sqlite3.OperationalError:
        # URI form rejected (exotic filesystem) — plain connect still works.
        return sqlite3.connect(str(path), timeout=30)


def verify_database(path: Path) -> bool:
    """True when SQLite reports the file as structurally intact."""
    if not path.exists():
        return False
    try:
        conn = _open_readonly(path)
    except sqlite3.Error:
        return False
    try:
        pragma = 'quick_check' if os.getenv('DB_INTEGRITY_CHECK', 'integrity').lower() == 'quick' \
            else 'integrity_check'
        row = conn.execute(f'PRAGMA {pragma}').fetchone()
        return bool(row) and str(row[0]).lower() == 'ok'
    except sqlite3.Error:
        return False
    finally:
        conn.close()


def sqlite_file_path(app) -> Path | None:
    """Absolute path of the app's SQLite file, or None when not file-backed."""
    url = app.config.get('SQLALCHEMY_DATABASE_URI') or ''
    if not url.startswith('sqlite'):
        return None
    try:
        from sqlalchemy.engine import make_url
        database = make_url(url).database
    except Exception:                                   # noqa: BLE001 - never block boot
        return None
    if not database or database == ':memory:':
        return None
    if database.startswith('file:'):
        return None                                     # URI-backed test DBs stay untouched
    return Path(database)


# ---------------------------------------------------------------------------
# Connection PRAGMAs
# ---------------------------------------------------------------------------

def install_sqlite_pragmas(engine) -> bool:
    """Apply durability PRAGMAs to every connection opened by ``engine``.

    ``foreign_keys`` is the important correctness fix: SQLite ships with
    foreign keys *off*, so the ``ON DELETE CASCADE`` rules on users ->
    bookmarks/notes/sessions silently did nothing and a deleted account could
    leave orphaned rows behind.
    """
    if engine.dialect.name != 'sqlite':
        return False
    try:
        database = engine.url.database
    except Exception:                                   # noqa: BLE001
        return False
    if not database or database == ':memory:':
        return False

    sync = os.getenv('SQLITE_SYNCHRONOUS', 'FULL').upper()
    if sync not in ('OFF', 'NORMAL', 'FULL', 'EXTRA'):
        sync = 'FULL'
    busy_ms = env_int('SQLITE_BUSY_TIMEOUT_MS', 10_000)
    wal_limit = env_int('SQLITE_JOURNAL_SIZE_LIMIT', 64 * 1024 * 1024)

    @event.listens_for(engine, 'connect')
    def _apply_pragmas(dbapi_connection, _record):      # noqa: ANN001
        try:
            cursor = dbapi_connection.cursor()
        except Exception:                               # noqa: BLE001 - non-SQLite conn
            return
        try:
            # WAL keeps readers unblocked while a writer commits; combined
            # with FULL sync a committed row survives a hard power cut.
            cursor.execute('PRAGMA journal_mode=WAL')
            cursor.execute(f'PRAGMA synchronous={sync}')
            cursor.execute(f'PRAGMA busy_timeout={busy_ms}')
            cursor.execute('PRAGMA foreign_keys=ON')
            cursor.execute(f'PRAGMA journal_size_limit={wal_limit}')
            cursor.execute('PRAGMA temp_store=MEMORY')
        except sqlite3.Error as exc:                    # noqa: PERF203 - never break a conn
            log.warning('sqlite pragma failed: %s', exc)
        finally:
            cursor.close()
    return True


# ---------------------------------------------------------------------------
# Backups
# ---------------------------------------------------------------------------

def backup_dir(db_path: Path) -> Path:
    configured = os.getenv('BACKUP_DIR', '').strip()
    target = Path(configured) if configured else db_path.parent / 'backups'
    target.mkdir(parents=True, exist_ok=True)
    return target


def list_backups(db_path: Path) -> list[Path]:
    """Verified backups, newest first."""
    candidates = list(backup_dir(db_path).glob('app-*.db'))
    return sorted(candidates, key=lambda p: p.stat().st_mtime, reverse=True)


def take_backup(db_path: Path, *, reason: str = 'auto', keep: int | None = None) -> Path | None:
    """Copy the live database into a *verified* backup, then rotate old ones.

    Uses SQLite's online backup API, which produces a consistent snapshot even
    while the API is writing (plain file copies of a WAL database do not).
    """
    if db_path is None or not db_path.exists():
        return None
    keep = env_int('BACKUP_KEEP', 30) if keep is None else keep

    stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    destination = backup_dir(db_path) / f'app-{stamp}-{reason}.db'
    counter = 1
    while destination.exists():                         # same-second collisions
        destination = destination.with_name(
            f'app-{stamp}-{reason}-{counter}.db')
        counter += 1

    temp = destination.with_name(f'.{destination.name}.partial')
    _clear_sidecars(temp)
    try:
        source = _open_readonly(db_path)
        try:
            target = sqlite3.connect(str(temp))
            try:
                source.backup(target)                   # consistent hot snapshot
                # Make the snapshot self-contained: a plain rollback journal
                # needs no -wal/-shm sidecars, so a single file can be copied
                # anywhere and restored as-is.
                target.execute('PRAGMA journal_mode=DELETE')
            finally:
                target.close()
        finally:
            source.close()
    except sqlite3.Error as exc:
        log.error('SEC-EVENT backup_failed reason=%s error=%r', reason, exc)
        _clear_sidecars(temp)
        temp.unlink(missing_ok=True)
        return None

    if not verify_database(temp):
        log.error('SEC-EVENT backup_unverifiable reason=%s', reason)
        _clear_sidecars(temp)
        temp.unlink(missing_ok=True)
        return None

    _clear_sidecars(temp)
    temp.replace(destination)
    _rotate(db_path, keep)
    log.info('SEC-EVENT backup_created file=%s reason=%s', destination.name, reason)
    return destination


def _clear_sidecars(path: Path) -> None:
    """Remove SQLite's ``-wal`` / ``-shm`` / ``-journal`` companions."""
    for suffix in ('-wal', '-shm', '-journal'):
        Path(str(path) + suffix).unlink(missing_ok=True)


def _rotate(db_path: Path, keep: int) -> None:
    if keep <= 0:
        return
    for stale in list_backups(db_path)[keep:]:
        try:
            _clear_sidecars(stale)
            stale.unlink()
        except OSError as exc:
            log.warning('could not prune old backup %s: %s', stale.name, exc)


def restore_latest_backup(db_path: Path) -> Path | None:
    """Swap in the newest backup that passes an integrity check."""
    for candidate in list_backups(db_path):
        if not verify_database(candidate):
            log.error('SEC-EVENT backup_rejected file=%s', candidate.name)
            continue
        staging = db_path.with_name(db_path.name + '.restoring')
        try:
            shutil.copyfile(candidate, staging)
            if not verify_database(staging):
                staging.unlink(missing_ok=True)
                continue
            _clear_sidecars(staging)
            for suffix in ('', '-wal', '-shm'):
                Path(str(db_path) + suffix).unlink(missing_ok=True)
            staging.replace(db_path)
        except OSError as exc:
            log.error('SEC-EVENT restore_failed file=%s error=%r', candidate.name, exc)
            staging.unlink(missing_ok=True)
            continue
        log.error('SEC-EVENT db_restored from=%s', candidate.name)
        return candidate
    return None


def check_and_repair(db_path: Path | None) -> str:
    """Boot-time integrity check. Returns ``ok`` / ``missing`` / ``restored``
    / ``corrupt`` (and raises when the database is unusable and unrepairable,
    so the app never starts on top of a silently damaged file)."""
    if db_path is None or not db_path.exists():
        return 'missing'
    if verify_database(db_path):
        return 'ok'

    log.error('SEC-EVENT db_corrupt path=%s', db_path)
    if not _env_bool('DB_AUTO_RESTORE', True):
        raise RuntimeError(
            f'Database failed its integrity check and DB_AUTO_RESTORE is off: {db_path}')

    if restore_latest_backup(db_path) is not None:
        return 'restored'

    if _env_bool('DB_ALLOW_CORRUPT_START', False):
        log.error('SEC-EVENT db_corrupt_starting_anyway path=%s', db_path)
        return 'corrupt'
    raise RuntimeError(
        f'Database is corrupt and no usable backup was found: {db_path}. '
        f'Backups live in {backup_dir(db_path)} — restore one manually, then restart.')


# ---------------------------------------------------------------------------
# Maintenance thread
# ---------------------------------------------------------------------------

class _Maintenance:
    """Daemon thread: periodic backups + pruning of stale rows."""

    def __init__(self, app, db_path: Path):
        self.app = app
        self.db_path = db_path
        self.stop = threading.Event()
        self.thread = None
        self._backup_every = float(env_int('BACKUP_INTERVAL_SECONDS', 86_400))
        self._prune_every = float(env_int('PRUNE_INTERVAL_SECONDS', 3_600))

    def start(self) -> None:
        if self.thread is not None:
            return
        self.thread = threading.Thread(
            target=self._run, name='linuxdocs-maintenance', daemon=True)
        self.thread.start()
        atexit.register(self.stop_event)
        log.info('SEC-EVENT maintenance_started backup_every=%ss prune_every=%ss',
                 int(self._backup_every), int(self._prune_every))

    def stop_event(self) -> None:
        self.stop.set()

    def _run(self) -> None:
        # First backup lands shortly after boot, then on the configured cadence.
        next_backup = time.monotonic() + min(self._backup_every, 300.0)
        next_prune = time.monotonic() + self._prune_every
        while not self.stop.wait(30.0):
            now = time.monotonic()
            if now >= next_backup:
                next_backup = now + self._backup_every
                self._guard(lambda: take_backup(self.db_path, reason='scheduled'))
            if now >= next_prune:
                next_prune = now + self._prune_every
                self._guard(self._prune)

    @staticmethod
    def _guard(fn) -> None:
        try:
            fn()
        except Exception:                               # noqa: BLE001 - never kill the thread
            log.exception('SEC-EVENT maintenance_task_failed')

    def _prune(self) -> None:
        from . import db
        from .models import PasswordResetToken, Session, utcnow

        with self.app.app_context():
            now = utcnow()
            # Sessions past their TTL can never authenticate again.
            expired = (Session.query
                       .filter(Session.expires_at < now)
                       .limit(500).all())
            # Rotated sessions are only kept for token-reuse (theft) detection;
            # after the retention window they are dead weight.
            horizon = now - timedelta(
                hours=env_int('ROTATED_SESSION_RETENTION_HOURS', 168))
            rotated = (Session.query
                       .filter(Session.rotated_at.isnot(None),
                               Session.rotated_at < horizon)
                       .limit(500).all())
            for row in {*expired, *rotated}:
                db.session.delete(row)

            # SQLAlchemy 2.0 refuses .delete() after .limit(); fetch first.
            stale_tokens = (PasswordResetToken.query
                            .filter((PasswordResetToken.expires_at < now)
                                    | (PasswordResetToken.used_at.isnot(None)))
                            .limit(500).all())
            for row in stale_tokens:
                db.session.delete(row)

            if expired or rotated or stale_tokens:
                db.session.commit()
                log.info('SEC-EVENT pruned sessions_expired=%d sessions_rotated=%d tokens_stale=%d',
                         len(expired), len(rotated), len(stale_tokens))


# ---------------------------------------------------------------------------
# Wiring
# ---------------------------------------------------------------------------

def configure_persistence(app) -> Path | None:
    """Install PRAGMAs and verify the database before the first connection.

    Call this after ``db.init_app(app)`` and **before** ``db.create_all()`` so
    the integrity check/restore happens while no connection holds the file.
    """
    db_path = sqlite_file_path(app)
    if db_path is None:
        return None

    from . import db
    try:
        engine = db.engines[app]
    except Exception:                                   # noqa: BLE001 - older/newer FSA
        engine = app.extensions['sqlalchemy'].engine
    install_sqlite_pragmas(engine)

    if _running_under_pytest():
        return db_path

    status = check_and_repair(db_path)
    log.info('SEC-EVENT db_start path=%s status=%s', db_path, status)
    return db_path


def prime_backup(db_path: Path | None, *, reason: str = 'startup') -> Path | None:
    """Take the boot-time backup (after the schema exists)."""
    if db_path is None or _running_under_pytest():
        return None
    if not _env_bool('BACKUP_ON_STARTUP', True):
        return None
    return take_backup(db_path, reason=reason)


def start_maintenance(app, db_path: Path | None) -> None:
    if db_path is None or _running_under_pytest():
        return
    if not _env_bool('MAINTENANCE_ENABLED', True):
        return
    if getattr(app, '_linuxdocs_maintenance', None) is not None:
        return
    worker = _Maintenance(app, db_path)
    app._linuxdocs_maintenance = worker                  # type: ignore[attr-defined]
    worker.start()


def _running_under_pytest() -> bool:
    # Keeps a file-backed test database from spawning backup/maintenance threads.
    return bool(os.getenv('PYTEST_CURRENT_TEST')) or bool(os.getenv('PYTEST_VERSION'))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def register_cli(app) -> None:
    """``flask backup`` / ``flask backups`` / ``flask restore``."""

    @app.cli.command('backup')
    def backup_command():
        """Take a verified snapshot of the database right now."""
        path = sqlite_file_path(app)
        if path is None:
            print('Not a file-backed SQLite database - nothing to back up.')
            return
        snapshot = take_backup(path, reason='manual')
        if snapshot is None:
            print('Backup FAILED - see the security log.')
            raise SystemExit(1)
        print(f'Backup written: {snapshot}')

    @app.cli.command('backups')
    def backups_command():
        """List stored backups, newest first."""
        path = sqlite_file_path(app)
        if path is None:
            print('Not a file-backed SQLite database.')
            return
        found = list_backups(path)
        if not found:
            print(f'No backups in {backup_dir(path)}')
            return
        for snapshot in found:
            state = 'ok' if verify_database(snapshot) else 'CORRUPT'
            print(f'{state:>7}  {snapshot.name}')

    @app.cli.command('restore')
    def restore_command():
        """Replace the live database with the newest verified backup."""
        path = sqlite_file_path(app)
        if path is None:
            print('Not a file-backed SQLite database - nothing to restore.')
            return
        restored = restore_latest_backup(path)
        if restored is None:
            print('No usable backup found.')
            raise SystemExit(1)
        print(f'Restored from {restored}. Stop and restart the app to pick it up.')
