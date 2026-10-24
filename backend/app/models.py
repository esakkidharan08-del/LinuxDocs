from datetime import datetime, timezone
from . import db, bcrypt
from sqlalchemy import UniqueConstraint, Index, func

# bcrypt only ever reads the first 72 bytes of a password and raises
# ``ValueError`` on anything longer. The password policy therefore caps input
# at 72 bytes, and the helpers below make sure a long password can *never*
# turn into a 500 - on register, login, password change or reset.
BCRYPT_MAX_BYTES = 72

_dummy_hash_cache: str | None = None


def _to_bytes(password: str) -> bytes:
    return password.encode('utf-8')


def _truncate(password: str) -> bytes:
    """First 72 UTF-8 bytes. Deterministic, so hash and check agree."""
    return _to_bytes(password)[:BCRYPT_MAX_BYTES]


def _dummy_hash() -> str:
    """A throwaway bcrypt hash of a random secret."""
    global _dummy_hash_cache
    if _dummy_hash_cache is None:
        _dummy_hash_cache = bcrypt.generate_password_hash(
            'timing-equaliser').decode('utf-8')
    return _dummy_hash_cache


def verify_against_dummy(password: str) -> None:
    """Burn one bcrypt comparison for a credential we already know is wrong.

    Login calls this when the email does not exist, so an unknown account and
    a wrong password cost the same wall-clock time and response timing cannot
    be used to enumerate registered email addresses.
    """
    bcrypt.check_password_hash(_dummy_hash(), _to_bytes(password)[:BCRYPT_MAX_BYTES])


def utcnow():
    """Timezone-aware UTC now (SQLite stores naive — normalise on read)."""
    return datetime.now(timezone.utc)


def ensure_tz(value):
    """Attach UTC tzinfo to naive datetimes read back from SQLite."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    bookmarks = db.relationship('Bookmark', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    notes = db.relationship('UserNote', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    history = db.relationship('RecentlyViewed', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    sessions = db.relationship('Session', backref='user', lazy='dynamic',
                               cascade='all, delete-orphan', passive_deletes=True)
    reset_tokens = db.relationship('PasswordResetToken', backref='user', lazy='dynamic',
                                   cascade='all, delete-orphan', passive_deletes=True)
    recovery_challenges = db.relationship('PasswordRecoveryChallenge', backref='user', lazy='dynamic',
                                          cascade='all, delete-orphan', passive_deletes=True)
    progress = db.relationship('UserProgress', backref='user', lazy='dynamic',
                               cascade='all, delete-orphan')

    def set_password(self, password: str):
        # Truncated to bcrypt's 72-byte block so a long passphrase can never
        # raise (bcrypt 4+/5 raises ValueError above 72 bytes). Existing hashes
        # are unaffected: every password already stored was <= 72 bytes.
        self.password_hash = bcrypt.generate_password_hash(
            _truncate(password)).decode('utf-8')

    def check_password(self, password: str) -> bool:
        raw = _to_bytes(password)
        if len(raw) > BCRYPT_MAX_BYTES:
            # No stored hash can come from an input this long (the policy caps
            # at 72 bytes), so it cannot match. Spending an equivalent bcrypt
            # comparison first keeps the response time identical to an ordinary
            # wrong password, so timing cannot be used to probe accounts.
            bcrypt.check_password_hash(_dummy_hash(), raw[:BCRYPT_MAX_BYTES])
            return False
        return bcrypt.check_password_hash(self.password_hash, raw)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Session(db.Model):
    """Revocable, rotating, server-side login session.

    The refresh cookie carries an opaque random token; only its SHA-256 hash
    is stored here. Every refresh rotates the token (old rows keep a
    ``rotated_at`` marker so token *reuse* can be detected as theft).
    ``remember`` sessions get a long sliding TTL; plain sessions die with the
    browser tab (session cookie) and on a short server-side TTL.
    """

    __tablename__ = 'sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    remember = db.Column(db.Boolean, nullable=False, default=False)
    revoked = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    rotated_at = db.Column(db.DateTime(timezone=True), nullable=True)
    replaced_by_id = db.Column(db.Integer, db.ForeignKey('sessions.id', ondelete='SET NULL'), nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)

    def is_expired(self) -> bool:
        return ensure_tz(self.expires_at) <= utcnow()

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'remember': self.remember,
            'created_at': ensure_tz(self.created_at).isoformat() if self.created_at else None,
            'last_seen_at': ensure_tz(self.last_seen_at).isoformat() if self.last_seen_at else None,
            'expires_at': ensure_tz(self.expires_at).isoformat() if self.expires_at else None,
        }


class PasswordResetToken(db.Model):
    """Legacy single-use, hashed email-reset tokens (30 minute TTL).

    Email-based reset was replaced by the knowledge-quiz recovery
    (``recovery.py`` / ``password_recovery_challenges``). The table is kept
    so old rows can still be audited and ``_revoke_all_auth`` can retire any
    outstanding tokens; no new rows are written.
    """

    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)

    def is_expired(self) -> bool:
        return ensure_tz(self.expires_at) <= utcnow()

    def is_used(self) -> bool:
        return self.used_at is not None


class PasswordRecoveryChallenge(db.Model):
    """One knowledge-quiz recovery attempt (no email involved).

    ``grant`` is an opaque random string that only ever lives in the
    HTTP response to /recovery/start; only its SHA-256 hash is stored
    (``challenge_hash``). ``questions`` holds the generated question set
    INCLUDING the correct option indexes — the server never sends them.
    ``verified_at`` (8+/10 correct) must be set before /recovery/complete
    will spend the grant; ``attempts`` counts wrong answer bundles (3 burns
    the grant); ``used_at`` makes it strictly single-use.
    """

    __tablename__ = 'password_recovery_challenges'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    mode = db.Column(db.String(16), nullable=False, default='challenge')  # 'challenge' | 'direct'
    challenge_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    questions = db.Column(db.JSON, nullable=False, default=list)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    verified_at = db.Column(db.DateTime(timezone=True), nullable=True)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)

    def is_expired(self) -> bool:
        return ensure_tz(self.expires_at) <= utcnow()


class Bookmark(db.Model):
    __tablename__ = 'bookmarks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    command_slug = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'command_slug', name='uq_user_command_bookmark'),
        Index('ix_bookmarks_user_created', 'user_id', 'created_at'),
    )

    def to_dict(self):
        return {
            'command_slug': self.command_slug,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class UserNote(db.Model):
    __tablename__ = 'user_notes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    command_slug = db.Column(db.String(100), nullable=False)
    text = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'command_slug', name='uq_user_command_note'),
        Index('ix_notes_user_updated', 'user_id', 'updated_at'),
    )

    def to_dict(self):
        return {
            'command_slug': self.command_slug,
            'text': self.text,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class RecentlyViewed(db.Model):
    __tablename__ = 'recently_viewed'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    command_slug = db.Column(db.String(100), nullable=False)
    viewed_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index('ix_recent_user_viewed', 'user_id', 'viewed_at'),
    )

    @staticmethod
    def add_view(user_id: int, command_slug: str, max_entries: int = 15):
        existing = RecentlyViewed.query.filter_by(user_id=user_id, command_slug=command_slug).first()
        now = datetime.now(timezone.utc)
        if existing:
            existing.viewed_at = now
        else:
            existing = RecentlyViewed(user_id=user_id, command_slug=command_slug, viewed_at=now)
            db.session.add(existing)
        db.session.flush()

        count = RecentlyViewed.query.filter_by(user_id=user_id).count()
        if count > max_entries:
            oldest = RecentlyViewed.query.filter_by(user_id=user_id).order_by(RecentlyViewed.viewed_at.asc()).limit(count - max_entries).all()
            for o in oldest:
                db.session.delete(o)

    def to_dict(self):
        return {
            'command_slug': self.command_slug,
            'viewed_at': self.viewed_at.isoformat() if self.viewed_at else None
        }


class UserProgress(db.Model):
    """Per-user synced learning progress (Part 2) — one row per (user, key).

    ``key`` names one of the shared progress namespaces (learning, terminal,
    flashcards, speeddrill, streak). ``version`` is a monotonic per-row
    counter that powers the conflict protocol: a client PUT carries the
    ``baseVersion`` it last saw, and a mismatch answers 409 with the current
    row so the client can apply the shared deterministic merge and retry.
    ``data`` is a strict-schema JSON payload (≤64 KB, capped server-side)
    whose merge rules are identical on both sides (`backend/app/
    progress_merge.py` ⇄ `src/lib/progress.ts`, pinned by qa/merge_vectors.json).
    """

    __tablename__ = 'user_progress'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    key = db.Column(db.String(32), nullable=False, index=True)
    version = db.Column(db.Integer, nullable=False, default=0)
    data = db.Column(db.JSON, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False, onupdate=utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'key', name='uq_user_progress_user_key'),
    )

    def to_dict(self):
        return {
            'key': self.key,
            'version': self.version,
            'data': self.data,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }