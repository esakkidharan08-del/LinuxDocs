import re
from flask import Blueprint, request, jsonify, current_app, make_response
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
    unset_jwt_cookies,
)
from . import db
from .models import (
    User, Session, PasswordResetToken, utcnow,
    BCRYPT_MAX_BYTES, verify_against_dummy,
)
from .security import (
    env_int, rate_limit, require_trusted_origin, register_failed_login,
    is_account_locked, clear_login_failures, client_ip, _warn_security,
    rate_limiter_enabled, sha256_hex,
)
from .sessions import (
    create_session, verify_session_token, rotate_session, revoke_session,
    set_refresh_cookie, clear_refresh_cookie, get_refresh_token_from_request,
    prune_expired_sessions,
)

auth_bp = Blueprint('auth', __name__)

EMAIL_REGEX = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

# A curated list of the most common breached passwords — rejected outright so
# users cannot pick credentials an attacker would try in the first ten guesses.
COMMON_PASSWORDS = {
    'password', 'password1', 'password123', '123456', '12345678', '123456789',
    '1234567890', 'qwerty', 'qwerty123', 'letmein', 'welcome', 'welcome1',
    'monkey', 'dragon', 'football', 'baseball', 'iloveyou', 'admin', 'admin123',
    'administrator', 'root', 'root123', 'toor', 'trustno1', 'sunshine', 'master',
    'login', 'passw0rd', 'abc123', '654321', '111111', '000000', '123123',
    'changeme', 'secret', 'secret123', 'shadow', 'michael', 'ashley', 'batman',
    'superman', 'starwars', 'pokemon', 'hello', 'hello123', 'princess', 'loveme',
    'whatever', 'zaq12wsx', 'qwertyuiop', 'password!', 'password1!', 'Password1!',
}


def password_content_errors(password: str):
    """Identity-free password rules — length, bytes, charset, breach list.

    Usable *before* a reset token is claimed: claiming is single-use, so a
    mistyped new password must not burn the token. Identity-bound rules live
    in ``password_policy_errors``.
    """
    errors = []
    if not password or len(password) < 10:
        errors.append('Password must be at least 10 characters')
    elif len(password) > 128:
        errors.append('Password too long')
    elif len(password.encode('utf-8')) > BCRYPT_MAX_BYTES:
        # bcrypt silently reads only the first 72 bytes, so anything longer
        # would be a false promise of extra entropy (and used to raise 500s).
        errors.append('Password must be at most 72 bytes — try a shorter passphrase')
    else:
        if not re.search(r'[A-Z]', password):
            errors.append('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', password):
            errors.append('Password must contain at least one lowercase letter')
        if not re.search(r'\d', password):
            errors.append('Password must contain at least one digit')
        if not re.search(r'[^A-Za-z0-9]', password):
            errors.append('Password must contain at least one special character')
    if password.lower() in COMMON_PASSWORDS:
        errors.append('That password is too common — choose something stronger')
    return errors


def password_policy_errors(password: str, username: str = '', email: str = ''):
    """Shared password strength rules. Returns a list of violation messages."""
    errors = password_content_errors(password)
    low = password.lower()
    if username and username.lower() in low:
        errors.append('Password must not contain your username')
    email_full = (email or '').lower()
    if email_full and email_full in low:
        errors.append('Password must not contain your email address')
    email_local = (email or '').split('@')[0].lower()
    if email_local and len(email_local) >= 5 and email_local in low:
        errors.append('Password must not contain your email address')
    return errors


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

    pw_errors = password_policy_errors(password, username, email)
    if pw_errors:
        errors['password'] = pw_errors[0]

    if password != confirm:
        errors['confirm_password'] = 'Passwords do not match'

    return errors


def _issue_session(user: User, remember: bool):
    """Create an access token + an opaque refresh session. Caller must commit."""
    access_token = create_access_token(identity=str(user.id))
    raw_refresh = create_session(user.id, remember=remember)
    db.session.commit()

    resp = jsonify({'user': user.to_dict(), 'access_token': access_token})
    resp = make_response(resp)
    set_refresh_cookie(resp, raw_refresh, remember)
    return resp


@auth_bp.route('/register', methods=['POST'])
@rate_limit('register:ip:{ip}', lambda: env_int('REGISTER_RATE_LIMIT', 10), 60)
def register():
    """Require a trusted origin (stops cross-site account creation), validate,
    create the user, and hand out a long-lived (remembered) session."""
    rejection = require_trusted_origin()
    if rejection:
        return rejection

    data = request.get_json(silent=True) or {}
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
    db.session.flush()

    resp = _issue_session(user, remember=True)
    resp.status_code = 201
    _warn_security('user_registered', user_id=user.id, ip=client_ip())
    return resp


@auth_bp.route('/login', methods=['POST'])
@rate_limit('login:ip:{ip}', lambda: env_int('LOGIN_RATE_LIMIT', 10), 60)
def login():
    """Login CSRF defense: a cross-site page must not be able to log a victim
    into an attacker-controlled account, so require a trusted Origin."""
    rejection = require_trusted_origin()
    if rejection:
        return rejection

    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    remember = data.get('remember', True)
    ip = client_ip()

    if not email or not password:
        return jsonify({'errors': {'general': 'Email and password required'}}), 400

    if rate_limiter_enabled():
        account_key = f'login:acct:{email}'
        if is_account_locked(account_key):
            return jsonify({'errors': {
                'general': 'Account temporarily locked. Try again later.'}}), 429
        auth_attempts = env_int('LOGIN_ACCOUNT_ATTEMPTS', 5)
        auth_window = float(env_int('LOGIN_ATTEMPT_WINDOW', 900))
        lockout_seconds = float(env_int('LOGIN_LOCKOUT_SECONDS', 900))

    user = User.query.filter_by(email=email).first()
    if user is None:
        # Unknown email: still spend one bcrypt comparison so response time
        # reveals nothing about which accounts exist.
        verify_against_dummy(password)
    if not user or not user.check_password(password):
        if rate_limiter_enabled():
            locked = register_failed_login(account_key, auth_window, lockout_seconds, auth_attempts)
            if locked:
                _warn_security('login_lockout', account=email, ip=ip)
        return jsonify({'errors': {'general': 'Invalid email or password'}}), 401

    if rate_limiter_enabled():
        clear_login_failures(account_key)
    if not isinstance(remember, bool):
        remember = True

    prune_expired_sessions()
    resp = _issue_session(user, remember=remember)
    _warn_security('user_login', user_id=user.id, ip=ip, remember=remember)
    return resp


@auth_bp.route('/refresh', methods=['POST'])
@rate_limit('refresh:ip:{ip}', lambda: env_int('REFRESH_RATE_LIMIT', 60), 60)
def refresh():
    """Rotate the opaque refresh session and mint a fresh access token.

    Cookie-authenticated, so a trusted Origin is required when the browser
    sends one (thwarts session-hijacking via cross-site requests)."""
    rejection = require_trusted_origin()
    if rejection:
        return rejection

    raw = get_refresh_token_from_request()
    verified = verify_session_token(raw)

    if verified is None:
        _warn_security('refresh_failed', ip=client_ip())
        return jsonify({'error': 'Session invalid or expired — please sign in again'}), 401

    session, fresh = verified
    user = User.query.get(session.user_id)
    if not user:
        revoke_session(session)
        return jsonify({'error': 'Session invalid — please sign in again'}), 401

    access_token = create_access_token(identity=str(user.id))
    if fresh:
        new_token, replacement = rotate_session(session)
        resp = make_response(jsonify({'access_token': access_token}))
        set_refresh_cookie(resp, new_token, replacement.remember)
        _warn_security('token_rotated', user_id=user.id, ip=client_ip())
        return resp

    # Grace-window parallel reuse: same session, quietly re-issue access token.
    return jsonify({'access_token': access_token}), 200


def _revoke_all_auth(user_id: int, *, keep_current: bool = True) -> None:
    """Revoke sessions + outstanding reset tokens for a user.

    ``keep_current=True`` (password *change* from Settings) leaves the current
    device signed in. Password RESET is an account-recovery path that may
    follow a takeover — there ``keep_current=False`` kills every session,
    including the one presenting the request's own cookie.
    """
    current = get_refresh_token_from_request()
    for s in Session.query.filter_by(user_id=user_id, revoked=False).all():
        if keep_current and current and s.token_hash == sha256_hex(current):
            continue
        s.revoked = True
    now = utcnow()
    PasswordResetToken.query.filter_by(user_id=user_id, used_at=None).update(
        {'used_at': now}, synchronize_session=False)


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Revoke the presented session server-side, then clear cookies."""
    raw = get_refresh_token_from_request()
    verified = verify_session_token(raw) if raw else None
    if verified is not None:
        revoke_session(verified[0])
        _warn_security('user_logout', user_id=verified[0].user_id, ip=client_ip())

    resp = make_response(jsonify({'message': 'Logged out'}), 200)
    unset_jwt_cookies(resp)      # clears access_token_cookie (+ legacy refresh cookie)
    clear_refresh_cookie(resp)
    return resp


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()}), 200