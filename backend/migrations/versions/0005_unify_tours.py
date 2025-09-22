"""Unify pickup and delivery declarations into a single tour record."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0005_unify_tours"
down_revision = "0004_tour_kind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tour",
        sa.Column("status", sa.String(), nullable=False, server_default="IN_PROGRESS"),
    )
    op.add_column(
        "tour_item",
        sa.Column("pickup_quantity", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tour_item",
        sa.Column("delivery_quantity", sa.Integer(), nullable=False, server_default="0"),
    )

    conn = op.get_bind()

    conn.execute(
        sa.text(
            "UPDATE tour SET status = CASE WHEN kind = 'DELIVERY' THEN 'COMPLETED' ELSE 'IN_PROGRESS' END"
        )
    )

    conn.execute(
        sa.text(
            """
            UPDATE tour_item AS ti
            SET pickup_quantity = ti.quantity
            FROM tour AS t
            WHERE ti.tour_id = t.id AND t.kind = 'PICKUP'
            """
        )
    )
    conn.execute(
        sa.text(
            """
            UPDATE tour_item AS ti
            SET delivery_quantity = ti.quantity
            FROM tour AS t
            WHERE ti.tour_id = t.id AND t.kind = 'DELIVERY'
            """
        )
    )

    deliveries = conn.execute(
        sa.text(
            """
            SELECT id, tenant_id, driver_id, client_id, date
            FROM tour
            WHERE kind = 'DELIVERY'
            ORDER BY id
            """
        )
    ).mappings().all()

    for delivery in deliveries:
        pickup = conn.execute(
            sa.text(
                """
                SELECT id FROM tour
                WHERE tenant_id = :tenant_id
                  AND driver_id = :driver_id
                  AND client_id = :client_id
                  AND date = :date
                  AND kind = 'PICKUP'
                ORDER BY id
                LIMIT 1
                """
            ),
            delivery,
        ).fetchone()

        if pickup:
            pickup_id = pickup[0]
            conn.execute(
                sa.text("UPDATE tour SET status = 'COMPLETED' WHERE id = :id"),
                {"id": pickup_id},
            )
            delivery_items = conn.execute(
                sa.text(
                    """
                    SELECT id, tenant_id, tariff_group_id, delivery_quantity,
                           unit_price_ex_vat_snapshot, amount_ex_vat_snapshot
                    FROM tour_item
                    WHERE tour_id = :tour_id
                    """
                ),
                {"tour_id": delivery["id"]},
            ).mappings().all()
            for item in delivery_items:
                existing = conn.execute(
                    sa.text(
                        """
                        SELECT id FROM tour_item
                        WHERE tour_id = :pickup_id AND tariff_group_id = :tg
                        """
                    ),
                    {"pickup_id": pickup_id, "tg": item["tariff_group_id"]},
                ).fetchone()
                if existing:
                    conn.execute(
                        sa.text(
                            """
                            UPDATE tour_item
                            SET delivery_quantity = :delivery_quantity,
                                unit_price_ex_vat_snapshot = :unit_price,
                                amount_ex_vat_snapshot = :amount
                            WHERE id = :id
                            """
                        ),
                        {
                            "delivery_quantity": item["delivery_quantity"],
                            "unit_price": item["unit_price_ex_vat_snapshot"],
                            "amount": item["amount_ex_vat_snapshot"],
                            "id": existing[0],
                        },
                    )
                else:
                    conn.execute(
                        sa.text(
                            """
                            INSERT INTO tour_item (
                                tenant_id, tour_id, tariff_group_id,
                                pickup_quantity, delivery_quantity,
                                unit_price_ex_vat_snapshot, amount_ex_vat_snapshot
                            ) VALUES (
                                :tenant_id, :tour_id, :tariff_group_id,
                                0, :delivery_quantity,
                                :unit_price, :amount
                            )
                            """
                        ),
                        {
                            "tenant_id": item["tenant_id"],
                            "tour_id": pickup_id,
                            "tariff_group_id": item["tariff_group_id"],
                            "delivery_quantity": item["delivery_quantity"],
                            "unit_price": item["unit_price_ex_vat_snapshot"],
                            "amount": item["amount_ex_vat_snapshot"],
                        },
                    )
            conn.execute(
                sa.text("DELETE FROM tour_item WHERE tour_id = :tour_id"),
                {"tour_id": delivery["id"]},
            )
            conn.execute(
                sa.text("DELETE FROM tour WHERE id = :id"),
                {"id": delivery["id"]},
            )
        else:
            conn.execute(
                sa.text("UPDATE tour SET status = 'COMPLETED' WHERE id = :id"),
                {"id": delivery["id"]},
            )
            conn.execute(
                sa.text(
                    """
                    UPDATE tour_item
                    SET pickup_quantity = delivery_quantity
                    WHERE tour_id = :tour_id
                    """
                ),
                {"tour_id": delivery["id"]},
            )

    op.drop_constraint("ck_tour_kind", "tour")
    op.drop_column("tour", "kind")
    op.drop_column("tour_item", "quantity")

    op.create_check_constraint(
        "ck_tour_status",
        "tour",
        "status IN ('IN_PROGRESS', 'COMPLETED')",
    )

    op.alter_column("tour", "status", server_default=None)
    op.alter_column("tour_item", "pickup_quantity", server_default=None)
    op.alter_column("tour_item", "delivery_quantity", server_default=None)


def downgrade() -> None:
    op.add_column(
        "tour_item",
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tour",
        sa.Column("kind", sa.String(), nullable=False, server_default="DELIVERY"),
    )

    conn = op.get_bind()

    conn.execute(sa.text("UPDATE tour SET kind = 'PICKUP'"))
    conn.execute(
        sa.text(
            """
            UPDATE tour_item
            SET quantity = pickup_quantity
            """
        )
    )

    completed_tours = conn.execute(
        sa.text(
            """
            SELECT id, tenant_id, driver_id, client_id, date, status
            FROM tour
            ORDER BY id
            """
        )
    ).mappings().all()

    for tour in completed_tours:
        if tour["status"] == "COMPLETED":
            new_tour_id = conn.execute(
                sa.text(
                    """
                    INSERT INTO tour (tenant_id, driver_id, client_id, date, kind, status)
                    VALUES (:tenant_id, :driver_id, :client_id, :date, 'DELIVERY', 'COMPLETED')
                    RETURNING id
                    """
                ),
                tour,
            ).scalar_one()
            items = conn.execute(
                sa.text(
                    """
                    SELECT tenant_id, tariff_group_id, delivery_quantity,
                           unit_price_ex_vat_snapshot, amount_ex_vat_snapshot
                    FROM tour_item
                    WHERE tour_id = :tour_id
                    """
                ),
                {"tour_id": tour["id"]},
            ).mappings().all()
            for item in items:
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO tour_item (
                            tenant_id, tour_id, tariff_group_id, quantity,
                            unit_price_ex_vat_snapshot, amount_ex_vat_snapshot
                        ) VALUES (
                            :tenant_id, :tour_id, :tariff_group_id, :quantity,
                            :unit_price, :amount
                        )
                        """
                    ),
                    {
                        "tenant_id": item["tenant_id"],
                        "tour_id": new_tour_id,
                        "tariff_group_id": item["tariff_group_id"],
                        "quantity": item["delivery_quantity"],
                        "unit_price": item["unit_price_ex_vat_snapshot"],
                        "amount": item["amount_ex_vat_snapshot"],
                    },
                )
            conn.execute(
                sa.text(
                    """
                    UPDATE tour_item
                    SET quantity = pickup_quantity
                    WHERE tour_id = :tour_id
                    """
                ),
                {"tour_id": tour["id"]},
            )

    op.drop_constraint("ck_tour_status", "tour")
    op.drop_column("tour_item", "delivery_quantity")
    op.drop_column("tour_item", "pickup_quantity")
    op.drop_column("tour", "status")

    op.create_check_constraint(
        "ck_tour_kind",
        "tour",
        "kind IN ('PICKUP', 'DELIVERY')",
    )
    op.alter_column("tour", "kind", server_default=None)
    op.alter_column("tour_item", "quantity", server_default=None)
