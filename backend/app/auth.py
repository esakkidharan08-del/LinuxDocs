import re
from flask import Blueprint, request, jsonify, current_app, make_response
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, set_refresh_cookies, unset_jwt_cookies,
    verify_jwt_in_request
)
from app import db, bcrypt
from app.models import User

auth_bp = Blueprint('auth', __name__)

EMAIL_REGEX = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

def validate_register(data):
    errors = {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    confirm = data.get('confirm_password', '')

    if not username or len(username) < 3 or len(username) > 50:
        errors['username'] = 'Username must be 3-50 characters'
    elif not re.match(r'^[a-zA-Z0-9_-]+$', username):
        errors['username'] = 'Username can only contain letters, numbers, underscore, and hyphen'

    if not email or not EMAIL_REGEX.match(email):
        errors['email'] = 'Valid email required'
    elif len(email) > 255:
        errors['email'] = 'Email too long'

    if not password or len(password) < 10:
        errors['password'] = 'Password must be at least 10 characters'
    elif len(password) > 128:
        errors['password'] = 'Password too long'
    elif not re.search(r'[A-Z]', password):
        errors['password'] = 'Password must contain at least one uppercase letter'
    elif not re.search(r'[a-z]', password):
        errors['password'] = 'Password must contain at least one lowercase letter'
    elif not re.search(r'\d', password):
        errors['password'] = 'Password must contain at least one digit'
    elif not re.search(r'[^A-Za-z0-9]', password):
        errors['password'] = 'Password must contain at least one special character'

    if password != confirm:
        errors['confirm_password'] = 'Passwords do not match'

    return errors


@auth_bp.route('/register', methods=['POST'])
def register():
    import sys
    print(f"DEBUG: Request content-type: {request.content_type}", file=sys.stderr)
    print(f"DEBUG: Request data: {request.get_data()}", file=sys.stderr)
    data = request.get_json(silent=True) or {}
    print(f"DEBUG: Parsed JSON: {data}", file=sys.stderr)
    errors = validate_register(data)

    if User.query.filter_by(username=data.get('username', '').strip()).first():
        errors['username'] = 'Username already taken'
    if User.query.filter_by(email=data.get('email', '').strip().lower()).first():
        errors['email'] = 'Email already registered'

    if errors:
        return jsonify({'errors': errors}), 400

    user = User(username=data['username'].strip(), email=data['email'].strip().lower())
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    resp = make_response(jsonify({
        'user': user.to_dict(),
        'access_token': access_token
    }), 201)
    set_refresh_cookies(resp, refresh_token)
    return resp


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    remember = data.get('remember', True)

    if not email or not password:
        return jsonify({'errors': {'general': 'Email and password required'}}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'errors': {'general': 'Invalid email or password'}}), 401

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    resp = make_response(jsonify({
        'user': user.to_dict(),
        'access_token': access_token
    }), 200)
    set_refresh_cookies(resp, refresh_token)
    return resp


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    access_token = create_access_token(identity=str(user.id))
    return jsonify({'access_token': access_token}), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    resp = make_response(jsonify({'message': 'Logged out'}), 200)
    unset_jwt_cookies(resp)
    return resp


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()}), 200