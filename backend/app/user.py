from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, Bookmark, UserNote, RecentlyViewed

user_bp = Blueprint('user', __name__)


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
    slug = data.get('command_slug', '').strip()

    if not slug:
        return jsonify({'error': 'command_slug required'}), 400

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
    slug = data.get('command_slug', '').strip()
    text = data.get('text', '')

    if not slug:
        return jsonify({'error': 'command_slug required'}), 400
    if not text or not text.strip():
        return jsonify({'error': 'Note text cannot be empty'}), 400
    if len(text) > 10000:
        return jsonify({'error': 'Note too long (max 10000 characters)'}), 400

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
    slug = data.get('command_slug', '').strip()

    if not slug:
        return jsonify({'error': 'command_slug required'}), 400

    RecentlyViewed.add_view(user_id, slug)
    db.session.commit()
    return jsonify({'message': 'Recorded'}), 200


# --- CHANGE PASSWORD ---
@user_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
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

    if not new or len(new) < 10:
        errors['new_password'] = 'New password must be at least 10 characters'
    elif not re.search(r'[A-Z]', new):
        errors['new_password'] = 'Must contain at least one uppercase letter'
    elif not re.search(r'[a-z]', new):
        errors['new_password'] = 'Must contain at least one lowercase letter'
    elif not re.search(r'\d', new):
        errors['new_password'] = 'Must contain at least one digit'
    elif not re.search(r'[^A-Za-z0-9]', new):
        errors['new_password'] = 'Must contain at least one special character'

    if new != confirm:
        errors['confirm_password'] = 'Passwords do not match'

    if errors:
        return jsonify({'errors': errors}), 400

    user.set_password(new)
    db.session.commit()
    return jsonify({'message': 'Password changed'}), 200


# --- DELETE ACCOUNT ---
@user_bp.route('/delete-account', methods=['DELETE'])
@jwt_required()
def delete_account():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    confirm = data.get('confirm', '')

    if confirm != user.username:
        return jsonify({'errors': {'confirm': 'Type your username to confirm deletion'}}), 400

    db.session.delete(user)
    db.session.commit()

    resp = make_response(jsonify({'message': 'Account deleted'}), 200)
    # Clear cookies
    resp.delete_cookie('refresh_token_cookie')
    return resp


import re