from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
import re

from . import db
from .models import User, Bookmark, UserNote, RecentlyViewed, Session
from .security import (
    rate_limit, require_trusted_origin, client_ip, _warn_security, env_int, sha256_hex,
)
from .auth import password_policy_errors
from .sessions import get_refresh_token_from_request

user_bp = Blueprint('user', __name__)

MAX_SLUG_LEN = 200
MAX_NOTE_LEN = 10000
MAX_IMPORT_ITEMS = 2000
# Every real dataset slug matches this (verified against the 132-entry synced
# dataset); bulk imports could otherwise plant junk keys forever.
SLUG_PATTERN = re.compile(r'^[a-z0-9/-]+$')


@user_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()}), 200


# --- BOOKMARKS ---
@user_bp.route('/bookmarks', methods=['GET'])
@jwt_required()
def get_bookmarks():
    user_id = get_jwt_identity()
    bookmarks = Bookmark.query.filter_by(user_id=user_id).order_by(Bookmark.created_at.desc()).all()
    return jsonify({'bookmarks': [b.to_dict() for b in bookmarks]}), 200


@user_bp.route('/bookmarks/toggle', methods=['POST'])
@jwt_required()
def toggle_bookmark():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    slug = (data.get('command_slug') or '').strip()

    if not slug:
        return jsonify({'error': 'command_slug required'}), 400
    if len(slug) > MAX_SLUG_LEN:
        return jsonify({'error': 'command_slug too long'}), 400

    existing = Bookmark.query.filter_by(user_id=user_id, command_slug=slug).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'bookmarked': False}), 200
    else:
        bookmark = Bookmark(user_id=user_id, command_slug=slug)
        db.session.add(bookmark)
        db.session.commit()
        return jsonify({'bookmarked': True, 'bookmark': bookmark.to_dict()}), 201


@user_bp.route('/bookmarks/set', methods=['POST'])
@jwt_required()
def set_bookmark():
    """Idempotent desired-state set for sync replays: unlike /toggle, replaying
    ``wanted=true`` can never delete an existing bookmark (offline queue ops may
    arrive for records that already exist server-side)."""
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    slug = (data.get('command_slug') or '').strip()
    wanted = data.get('wanted')

    if not slug:
        return jsonify({'error': 'command_slug required'}), 400
    if len(slug) > MAX_SLUG_LEN:
        return jsonify({'error': 'command_slug too long'}), 400
    if not isinstance(wanted, bool):
        return jsonify({'error': 'wanted must be a boolean'}), 400

    existing = Bookmark.query.filter_by(user_id=user_id, command_slug=slug).first()
    if wanted and not existing:
        bookmark = Bookmark(user_id=user_id, command_slug=slug)
        db.session.add(bookmark)
        db.session.commit()
        return jsonify({'bookmarked': True, 'bookmark': bookmark.to_dict()}), 201
    if not wanted and existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'bookmarked': False}), 200
    # Already in the desired state — nothing to do, still an ack.
    return jsonify({'bookmarked': bool(existing)}), 200


# --- NOTES ---
@user_bp.route('/notes', methods=['GET'])
@jwt_required()
def get_notes():
    user_id = get_jwt_identity()
    notes = UserNote.query.filter_by(user_id=user_id).order_by(UserNote.updated_at.desc()).all()
    return jsonify({'notes': [n.to_dict() for n in notes]}), 200


@user_bp.route('/notes', methods=['POST'])
@jwt_required()
def upsert_note():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    slug = (data.get('command_slug') or '').strip()
    text = data.get('text', '')

    if not slug:
        return jsonify({'error': 'command_slug required'}), 400
    if len(slug) > MAX_SLUG_LEN:
        return jsonify({'error': 'command_slug too long'}), 400
    if not isinstance(text, str):
        return jsonify({'error': 'Note text must be a string'}), 400
    if not text or not text.strip():
        return jsonify({'error': 'Note text cannot be empty'}), 400
    if len(text) > MAX_NOTE_LEN:
        return jsonify({'error': f'Note too long (max {MAX_NOTE_LEN} characters)'}), 400

    note = UserNote.query.filter_by(user_id=user_id, command_slug=slug).first()
    if note:
        note.text = text.strip()
    else:
        note = UserNote(user_id=user_id, command_slug=slug, text=text.strip())
        db.session.add(note)
    db.session.commit()
    return jsonify({'note': note.to_dict()}), 200


@user_bp.route('/notes/<string:command_slug>', methods=['DELETE'])
@jwt_required()
def delete_note(command_slug):
    user_id = get_jwt_identity()
    note = UserNote.query.filter_by(user_id=user_id, command_slug=command_slug).first()
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    db.session.delete(note)
    db.session.commit()
    return jsonify({'message': 'Note deleted'}), 200


# --- HISTORY ---
@user_bp.route('/history', methods=['GET'])
@jwt_required()
def get_history():
    user_id = get_jwt_identity()
    history = RecentlyViewed.query.filter_by(user_id=user_id).order_by(RecentlyViewed.viewed_at.desc()).limit(15).all()
    return jsonify({'history': [h.to_dict() for h in history]}), 200


@user_bp.route('/history/add', methods=['POST'])
@jwt_required()
def add_history():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    slug = (data.get('command_slug') or '').strip()

    if not slug:
        return jsonify({'error': 'command_slug required'}), 400
    if len(slug) > MAX_SLUG_LEN:
        return jsonify({'error': 'command_slug too long'}), 400

    RecentlyViewed.add_view(user_id, slug)
    db.session.commit()
    return jsonify({'message': 'Recorded'}), 200


@user_bp.route('/data/import', methods=['POST'])
@jwt_required()
def import_data():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    bookmarks = data.get('bookmarks', [])
    notes = data.get('notes', [])
    if not isinstance(bookmarks, list) or not isinstance(notes, list):
        return jsonify({'error': 'bookmarks and notes must be arrays'}), 400
    if len(bookmarks) > MAX_IMPORT_ITEMS or len(notes) > MAX_IMPORT_ITEMS:
        return jsonify({'error': f'Import is limited to {MAX_IMPORT_ITEMS} items per collection'}), 400
    for slug in bookmarks:
        if isinstance(slug, str) and slug.strip() and len(slug) <= MAX_SLUG_LEN \
                and SLUG_PATTERN.fullmatch(slug.strip()):
            existing = Bookmark.query.filter_by(user_id=user_id, command_slug=slug.strip()).first()
            if not existing:
                db.session.add(Bookmark(user_id=user_id, command_slug=slug.strip()))
    for item in notes:
        if not isinstance(item, dict) or not isinstance(item.get('command_slug'), str) or not isinstance(item.get('text'), str):
            continue
        slug = item['command_slug'].strip()
        text = item['text'].strip()
        if not slug or not text or len(slug) > MAX_SLUG_LEN or len(text) > MAX_NOTE_LEN:
            continue
        if not SLUG_PATTERN.fullmatch(slug):
            continue
        note = UserNote.query.filter_by(user_id=user_id, command_slug=slug).first()
        if note:
            note.text = text
        else:
            db.session.add(UserNote(user_id=user_id, command_slug=slug, text=text))
    db.session.commit()
    return jsonify({'message': 'Data imported'}), 200


# --- CHANGE PASSWORD ---
@user_bp.route('/change-password', methods=['POST'])
@jwt_required()
@rate_limit('change-pwd:ip:{ip}', lambda: env_int('CHANGE_PASSWORD_RATE_LIMIT', 10), 600)
def change_password():
    rejection = require_trusted_origin()
    if rejection:
        return rejection

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    current = data.get('current_password', '')
    new = data.get('new_password', '')
    confirm = data.get('confirm_password', '')

    errors = {}
    if not current:
        errors['current_password'] = 'Current password required'
    elif not user.check_password(current):
        errors['current_password'] = 'Current password incorrect'

    pw_errors = password_policy_errors(new, user.username, user.email)
    if pw_errors:
        errors['new_password'] = pw_errors[0]

    if new != confirm:
        errors['confirm_password'] = 'Passwords do not match'

    if errors:
        return jsonify({'errors': errors}), 400

    user.set_password(new)
    # Keep THIS device signed in, drop every other session.
    raw = get_refresh_token_from_request()
    sessions = Session.query.filter_by(user_id=user_id, revoked=False).all()
    current_hash = sha256_hex(raw) if raw else None
    revoked = 0
    for s in sessions:
        if current_hash and s.token_hash == current_hash:
            continue
        s.revoked = True
        revoked += 1
    db.session.commit()
    _warn_security('password_changed', user_id=user_id, ip=client_ip(), other_sessions_revoked=revoked)
    return jsonify({'message': 'Password changed'}), 200


# --- DELETE ACCOUNT ---
@user_bp.route('/delete-account', methods=['DELETE'])
@jwt_required()
@rate_limit('delete-acct:ip:{ip}', lambda: env_int('DELETE_ACCOUNT_RATE_LIMIT', 5), 3600)
def delete_account():
    rejection = require_trusted_origin()
    if rejection:
        return rejection

    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    confirm = data.get('confirm', '')

    if confirm != user.username:
        return jsonify({'errors': {'confirm': 'Type your username to confirm deletion'}}), 400

    db.session.delete(user)  # sessions + reset tokens cascade via FK
    db.session.commit()

    resp = make_response(jsonify({'message': 'Account deleted'}), 200)
    # Clear cookies
    resp.delete_cookie('refresh_token_cookie')
    return resp
