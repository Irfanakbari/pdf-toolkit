"""add job stage

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("jobs", sa.Column("stage", sa.String(64), nullable=True))


def downgrade():
    op.drop_column("jobs", "stage")
