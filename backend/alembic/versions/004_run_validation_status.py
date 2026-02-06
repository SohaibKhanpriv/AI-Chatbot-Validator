"""Add validation_status to runs for manual validation workflow

Revision ID: 004
Revises: 003
Create Date: 2025-02-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("validation_status", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("runs", "validation_status")
