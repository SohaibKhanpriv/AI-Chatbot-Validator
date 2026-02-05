"""Add sort_order to queries for explicit ordering

Revision ID: 003
Revises: 002
Create Date: 2025-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("queries", sa.Column("sort_order", sa.Integer(), nullable=True))
    op.execute("UPDATE queries SET sort_order = id WHERE sort_order IS NULL")
    op.alter_column(
        "queries",
        "sort_order",
        existing_type=sa.Integer(),
        nullable=False,
        server_default=sa.text("0"),
    )


def downgrade() -> None:
    op.drop_column("queries", "sort_order")
