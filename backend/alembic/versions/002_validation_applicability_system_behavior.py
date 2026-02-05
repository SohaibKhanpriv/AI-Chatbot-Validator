"""Add applies_to_all, additional_info to validation_criteria; system_behavior to datasets

Revision ID: 002
Revises: 001
Create Date: 2025-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("validation_criteria", sa.Column("applies_to_all", sa.Boolean(), nullable=True))
    op.add_column("validation_criteria", sa.Column("additional_info", sa.Text(), nullable=True))
    op.execute("UPDATE validation_criteria SET applies_to_all = true WHERE applies_to_all IS NULL")
    op.alter_column(
        "validation_criteria",
        "applies_to_all",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.true(),
    )
    op.add_column("datasets", sa.Column("system_behavior", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("datasets", "system_behavior")
    op.drop_column("validation_criteria", "additional_info")
    op.drop_column("validation_criteria", "applies_to_all")
