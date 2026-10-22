"""user_progress — per-user synced learning progress (Part 2).

One row per (user_id, key): ``key`` names the progress namespace (learning,
terminal, flashcards, speeddrill, streak), ``version`` is the optimistic
concurrency counter behind the PUT 409 protocol, ``data`` is the strict-schema
JSON payload (≤64 KB, enforced at the endpoint layer). The unique constraint
makes every (user, key) pair single-row and keeps replays idempotent.
"""

revision = '002_user_progress'
down_revision = '001_initial'
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.create_table(
        'user_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=32), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'key', name='uq_user_progress_user_key'),
    )
    op.create_index('ix_user_progress_user_id', 'user_progress', ['user_id'], unique=False)
    op.create_index('ix_user_progress_key', 'user_progress', ['key'], unique=False)


def downgrade():
    op.drop_index('ix_user_progress_key', table_name='user_progress')
    op.drop_index('ix_user_progress_user_id', table_name='user_progress')
    op.drop_table('user_progress')
