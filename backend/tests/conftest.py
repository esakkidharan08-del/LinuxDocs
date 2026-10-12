import sys
import os

# Set test environment variables BEFORE importing app
os.environ['SECRET_KEY'] = 'test-secret-key-for-testing-only'
os.environ['JWT_SECRET_KEY'] = 'test-jwt-secret-key-for-testing-only'
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['FRONTEND_ORIGIN'] = 'http://localhost:5173'
os.environ['JWT_ACCESS_TOKEN_EXPIRES'] = '900'
os.environ['JWT_REFRESH_TOKEN_EXPIRES'] = '2592000'

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))