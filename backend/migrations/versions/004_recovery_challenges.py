"""password_recovery_challenges — knowledge-quiz password recovery.

Replaces email-based password reset: one row per recovery start, carrying
the generated question set (with correct option indexes, never sent to the
client), attempt counter, verify/used markers and TTL. Grants are opaque
random strings; the DB stores only their SHA-256 hash.

The legacy ``password_reset_tokens`` table is left in place (empty from now
on) so no destructive DDL is needed.
"""

revision = '004_recovery_challenges'
down_revision = '003_rls_lockdown'
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op

# This migration introduces the only new table; the rest of the RLS lockdown
# (all other app tables) lives in 003_rls_lockdown. Same policy: RLS on, NO
# permissive policy so the Supabase Data API sees nothing, Flask (BYPASSRLS
# postgres role) works unaffected. No-op on SQLite like the rest of the chain.
APP_TABLES = ('password_recovery_challenges',)


def _upgrade_body():
    op.create_table(
        'password_recovery_challenges',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('mode', sa.String(length=16), nullable=False),
        sa.Column('challenge_hash', sa.String(length=64), nullable=False),
        sa.Column('questions', sa.JSON(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_recovery_user_id', 'password_recovery_challenges', ['user_id'], unique=False)
    op.create_index('ix_recovery_challenge_hash', 'password_recovery_challenges', ['challenge_hash'], unique=True)
    if op.get_bind().dialect.name == 'postgresql':
        op.execute('ALTER TABLE "password_recovery_challenges" ENABLE ROW LEVEL SECURITY')


def _downgrade_body():
    op.drop_index('ix_recovery_challenge_hash', table_name='password_recovery_challenges')
    op.drop_index('ix_recovery_user_id', table_name='password_recovery_challenges')
    op.drop_table('password_recovery_challenges')


def upgrade():
    _upgrade_body()


def downgrade():
    _downgrade_body()
