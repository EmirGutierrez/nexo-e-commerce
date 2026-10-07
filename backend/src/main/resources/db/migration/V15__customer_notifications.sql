CREATE TABLE customer_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_user_id UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    order_record_id UUID REFERENCES commerce_orders (record_id) ON DELETE CASCADE,
    notification_type VARCHAR(40) NOT NULL,
    title VARCHAR(120) NOT NULL,
    message VARCHAR(500) NOT NULL,
    dedupe_key VARCHAR(220) NOT NULL UNIQUE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX customer_notifications_user_date_idx
    ON customer_notifications (customer_user_id, created_at DESC);

CREATE INDEX customer_notifications_user_unread_idx
    ON customer_notifications (customer_user_id, created_at DESC)
    WHERE read_at IS NULL;
