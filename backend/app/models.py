from datetime import datetime, timezone
from app import db, bcrypt
from sqlalchemy import UniqueConstraint, Index, func

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    bookmarks = db.relationship('Bookmark', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    notes = db.relationship('UserNote', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    history = db.relationship('RecentlyViewed', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password: str):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


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