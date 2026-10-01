ALTER TABLE permissions DROP CONSTRAINT permissions_module_allowed;
ALTER TABLE permissions ADD CONSTRAINT permissions_module_allowed CHECK (
    module_code IN ('dashboard', 'products', 'inventory', 'orders', 'sales', 'customers',
                    'suppliers', 'reports', 'accounting', 'promotions', 'settings', 'users')
);

INSERT INTO permissions (module_code, action_code) VALUES
    ('promotions', 'view'), ('promotions', 'create'), ('promotions', 'edit'), ('promotions', 'delete');
INSERT INTO role_permissions (role_code, module_code, action_code)
SELECT 'superadmin', module_code, action_code FROM permissions WHERE module_code = 'promotions';

CREATE TABLE product_offers (
    id VARCHAR(80) PRIMARY KEY,
    product_record_id UUID NOT NULL UNIQUE REFERENCES products (record_id) ON DELETE RESTRICT,
    original_price NUMERIC(14,2) NOT NULL,
    discounted_price NUMERIC(14,2) NOT NULL,
    starts_at DATE NOT NULL,
    ends_at DATE NOT NULL,
    status VARCHAR(12) NOT NULL,
    CONSTRAINT product_offers_price_allowed CHECK (original_price > 0 AND discounted_price > 0 AND discounted_price < original_price),
    CONSTRAINT product_offers_date_allowed CHECK (starts_at <= ends_at),
    CONSTRAINT product_offers_status_allowed CHECK (status IN ('Activa', 'Pausada'))
);
CREATE INDEX product_offers_active_idx ON product_offers (starts_at, ends_at) WHERE status = 'Activa';

CREATE TABLE store_announcements (
    id VARCHAR(80) PRIMARY KEY,
    title VARCHAR(70) NOT NULL,
    description VARCHAR(160) NOT NULL,
    href VARCHAR(500) NOT NULL,
    status VARCHAR(12) NOT NULL,
    CONSTRAINT store_announcements_status_allowed CHECK (status IN ('Activa', 'Pausada')),
    CONSTRAINT store_announcements_href_internal CHECK (LEFT(href, 1) = '/' AND LEFT(href, 2) <> '//')
);

CREATE TABLE discount_codes (
    id VARCHAR(80) PRIMARY KEY,
    code VARCHAR(24) NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL,
    min_purchase NUMERIC(14,2) NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    starts_at DATE NOT NULL,
    ends_at DATE NOT NULL,
    status VARCHAR(12) NOT NULL,
    CONSTRAINT discount_codes_percent_allowed CHECK (discount_percent BETWEEN 1 AND 80),
    CONSTRAINT discount_codes_purchase_nonnegative CHECK (min_purchase >= 0),
    CONSTRAINT discount_codes_uses_allowed CHECK (max_uses > 0 AND used_count >= 0 AND used_count <= max_uses),
    CONSTRAINT discount_codes_date_allowed CHECK (starts_at <= ends_at),
    CONSTRAINT discount_codes_status_allowed CHECK (status IN ('Activo', 'Pausado'))
);

ALTER TABLE commerce_orders ADD COLUMN subtotal NUMERIC(14,2);
UPDATE commerce_orders SET subtotal = total;
ALTER TABLE commerce_orders ALTER COLUMN subtotal SET NOT NULL;
ALTER TABLE commerce_orders ADD COLUMN discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE commerce_orders ADD COLUMN discount_code VARCHAR(24);
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_discount_valid CHECK (
    subtotal >= 0 AND discount_amount >= 0 AND total = subtotal - discount_amount
);

CREATE TABLE transfer_receipts (
    order_record_id UUID PRIMARY KEY REFERENCES commerce_orders (record_id) ON DELETE RESTRICT,
    image_data_url TEXT NOT NULL,
    file_name VARCHAR(255),
    reference VARCHAR(160),
    status VARCHAR(12) NOT NULL DEFAULT 'Pendiente',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES app_user (id) ON DELETE SET NULL,
    CONSTRAINT transfer_receipts_status_allowed CHECK (status IN ('Pendiente', 'Aprobada', 'Rechazada')),
    CONSTRAINT transfer_receipts_image_size CHECK (LENGTH(image_data_url) BETWEEN 100 AND 2000000)
);
CREATE INDEX transfer_receipts_pending_idx ON transfer_receipts (submitted_at DESC) WHERE status = 'Pendiente';

UPDATE products SET status = CASE
    WHEN status IN ('Inactivo', 'Inactive', 'DISABLED') THEN 'Inactivo'
    WHEN stock = 0 THEN 'Agotado'
    WHEN stock < 10 THEN 'Bajo stock'
    ELSE 'Activo'
END;
UPDATE business_records AS record
SET data = jsonb_set(record.data, '{status}', to_jsonb(product.status)),
    status_code = product.status
FROM products AS product
WHERE record.id = product.record_id;
ALTER TABLE products ADD CONSTRAINT products_status_allowed CHECK (status IN ('Activo', 'Inactivo', 'Bajo stock', 'Agotado'));
