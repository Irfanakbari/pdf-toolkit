"""initial jobs and logs

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None
status = postgresql.ENUM(
    "CREATED",
    "UPLOADING",
    "QUEUED",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
    name="job_status",
)


def upgrade():
    status.create(op.get_bind())
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tool", sa.String(32), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("options", postgresql.JSONB(), nullable=False),
        sa.Column("files", postgresql.JSONB(), nullable=False),
        sa.Column("output_name", sa.String(255)),
        sa.Column("output_size", sa.BigInteger()),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("error_code", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_owner", sa.String(128)),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_jobs_tool", "jobs", ["tool"])
    op.create_index("ix_jobs_status", "jobs", ["status"])
    op.create_index("ix_jobs_expires_at", "jobs", ["expires_at"])
    op.create_table(
        "job_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("level", sa.String(16), nullable=False),
        sa.Column("event", sa.String(64), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_job_logs_job_id", "job_logs", ["job_id"])


def downgrade():
    op.drop_table("job_logs")
    op.drop_table("jobs")
    status.drop(op.get_bind())
