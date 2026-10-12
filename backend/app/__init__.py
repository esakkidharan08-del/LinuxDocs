import os
import sys
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

def validate_env():
    required = ['SECRET_KEY', 'JWT_SECRET_KEY', 'DATABASE_URL', 'FRONTEND_ORIGIN']
    missing = [var for var in required if not os.getenv(var)]
    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        print("Copy .env.example to .env and fill in all values.", file=sys.stderr)
        sys.exit(1)

validate_env()

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 900))
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', 2592000))
    app.config['JWT_TOKEN_LOCATION'] = ['headers', 'cookies']
    app.config['JWT_COOKIE_SECURE'] = not os.getenv('FRONTEND_ORIGIN', '').startswith('http://localhost')
    app.config['JWT_COOKIE_SAMESITE'] = 'Lax'
    app.config['JWT_COOKIE_CSRF_PROTECT'] = False

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    frontend_origin = os.getenv('FRONTEND_ORIGIN')
    CORS(app, origins=[frontend_origin], supports_credentials=True)

    from app.models import User, Bookmark, UserNote, RecentlyViewed
    from app.auth import auth_bp
    from app.user import user_bp
    from app.commands import commands_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(user_bp, url_prefix='/api/user')
    app.register_blueprint(commands_bp, url_prefix='/api')

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'ok'})

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': 'Internal server error'}), 500

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({'error': 'Token has expired'}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({'error': 'Invalid token'}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({'error': 'Authorization required'}), 401

    with app.app_context():
        db.create_all()

    return app
