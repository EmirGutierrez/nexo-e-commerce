ALTER TABLE commerce_orders
    ADD COLUMN customer_user_id UUID REFERENCES app_user (id) ON DELETE SET NULL;

UPDATE commerce_orders o
SET customer_user_id = u.id
FROM app_user u
WHERE LOWER(o.customer_email) = LOWER(u.email)
  AND u.role_code = 'customer';

CREATE INDEX commerce_orders_customer_user_date_idx
    ON commerce_orders (customer_user_id, order_date DESC);

CREATE TABLE customer_wishlist_items (
    customer_user_id UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    product_record_id UUID NOT NULL REFERENCES products (record_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_user_id, product_record_id)
);
