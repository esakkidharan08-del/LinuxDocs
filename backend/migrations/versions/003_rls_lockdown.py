"""rls lockdown — deny the Supabase Data API on every application table.

Supabase projects can expose the ``public`` schema through its REST Data API
using the project's anon key. This migration ENABLES Row Level Security on
every application table and deliberately adds NO permissive policy: without a
policy, RLS denies every row to every non-bypassing role, so the Data API
(anon/authenticated) sees empty results for all tables while the Flask app —
whose ``postgres`` role has the BYPASSRLS privilege — keeps working untouched.

Nothing else is needed in the application: never fetch data with the anon or
service-role key from frontend or backend; the only credentials live in
DATABASE_URL. (To switch the Data API off entirely for this project:
Supabase dashboard → Project Settings → API → disable "Data API".)

No-op on SQLite: it has no RLS, and local dev/tests run on it directly.
"""

revision = '003_rls_lockdown'
down_revision = '002_user_progress'
branch_labels = None
depends_on = None

from alembic import op  # noqa: E402

# Literal list (not derived from the ORM) so the migration also works when
# run from a standalone alembic without the app package importable.
# tests/test_migrations.py asserts this list always matches the models.
APP_TABLES = (
    'users',
    'sessions',
    'password_reset_tokens',
    'bookmarks',
    'user_notes',
    'recently_viewed',
    'user_progress',
)


def upgrade():
    if op.get_bind().dialect.name != 'postgresql':
        return
    for table in APP_TABLES:
        # Postgres identifiers here are closed-set literals — no injection.
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')


def downgrade():
    if op.get_bind().dialect.name != 'postgresql':
        return
    for table in APP_TABLES:
        op.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY')
