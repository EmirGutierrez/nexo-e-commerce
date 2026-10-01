CREATE TABLE brands (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(1000), contact VARCHAR(160), website VARCHAR(300),
    status VARCHAR(20) NOT NULL DEFAULT 'Activa',
    CONSTRAINT brands_status_allowed CHECK (status IN ('Activa', 'Inactiva'))
);

CREATE TABLE product_categories (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'Activo',
    CONSTRAINT product_categories_status_allowed CHECK (status IN ('Activo', 'Inactivo'))
);

CREATE TABLE products (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    brand_record_id UUID REFERENCES brands (record_id) ON DELETE SET NULL,
    category_record_id UUID REFERENCES product_categories (record_id) ON DELETE SET NULL,
    sku VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    price NUMERIC(14,2) NOT NULL,
    compare_at NUMERIC(14,2),
    stock INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    image_url VARCHAR(1000),
    description TEXT NOT NULL DEFAULT '',
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT products_price_nonnegative CHECK (price >= 0),
    CONSTRAINT products_compare_at_positive CHECK (compare_at IS NULL OR compare_at >= price),
    CONSTRAINT products_stock_nonnegative CHECK (stock >= 0)
);
CREATE INDEX products_category_status_idx ON products (category_name, status);
CREATE INDEX products_brand_idx ON products (brand_record_id);
CREATE INDEX products_stock_idx ON products (stock) WHERE stock < 10;

CREATE TABLE suppliers (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL UNIQUE,
    contact_person VARCHAR(160), phone VARCHAR(40), email VARCHAR(254),
    status VARCHAR(20) NOT NULL DEFAULT 'Activo',
    CONSTRAINT suppliers_status_allowed CHECK (status IN ('Activo', 'Inactivo'))
);

CREATE TABLE supplier_products (
    supplier_record_id UUID NOT NULL REFERENCES suppliers (record_id) ON DELETE CASCADE,
    product_record_id UUID NOT NULL REFERENCES products (record_id) ON DELETE RESTRICT,
    PRIMARY KEY (supplier_record_id, product_record_id)
);
CREATE INDEX supplier_products_product_idx ON supplier_products (product_record_id);

CREATE TABLE customers (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    phone VARCHAR(40), status VARCHAR(20) NOT NULL DEFAULT 'Activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customers_status_allowed CHECK (status IN ('Activo', 'Inactivo', 'Pendiente'))
);
CREATE INDEX customers_name_idx ON customers (LOWER(name));

CREATE TABLE commerce_orders (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    customer_name VARCHAR(160) NOT NULL,
    customer_email VARCHAR(254), order_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(40) NOT NULL,
    payment_method VARCHAR(24) NOT NULL,
    payment_status VARCHAR(40) NOT NULL,
    total NUMERIC(14,2) NOT NULL,
    CONSTRAINT commerce_orders_total_nonnegative CHECK (total >= 0),
    CONSTRAINT commerce_orders_payment_method_allowed CHECK (payment_method IN ('card', 'transfer'))
);
CREATE INDEX commerce_orders_date_status_idx ON commerce_orders (order_date DESC, status);
CREATE INDEX commerce_orders_email_idx ON commerce_orders (LOWER(customer_email));

CREATE TABLE commerce_order_items (
    order_record_id UUID NOT NULL REFERENCES commerce_orders (record_id) ON DELETE CASCADE,
    product_record_id UUID NOT NULL REFERENCES products (record_id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(180) NOT NULL,
    sku_snapshot VARCHAR(80) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL,
    line_total NUMERIC(14,2) NOT NULL,
    PRIMARY KEY (order_record_id, product_record_id),
    CONSTRAINT commerce_order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT commerce_order_items_price_nonnegative CHECK (unit_price >= 0)
);

CREATE TABLE merchandise_purchases (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    supplier_record_id UUID NOT NULL REFERENCES suppliers (record_id) ON DELETE RESTRICT,
    purchase_date DATE NOT NULL,
    status VARCHAR(24) NOT NULL,
    total NUMERIC(14,2) NOT NULL,
    CONSTRAINT merchandise_purchases_status_allowed CHECK (status IN ('Registrada', 'Pendiente', 'Anulada')),
    CONSTRAINT merchandise_purchases_total_nonnegative CHECK (total >= 0)
);
CREATE INDEX merchandise_purchases_date_idx ON merchandise_purchases (purchase_date DESC);

CREATE TABLE merchandise_purchase_items (
    purchase_record_id UUID NOT NULL REFERENCES merchandise_purchases (record_id) ON DELETE CASCADE,
    product_record_id UUID NOT NULL REFERENCES products (record_id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(180) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(14,2) NOT NULL,
    line_total NUMERIC(14,2) NOT NULL,
    PRIMARY KEY (purchase_record_id, product_record_id),
    CONSTRAINT merchandise_purchase_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT merchandise_purchase_items_cost_positive CHECK (unit_cost > 0)
);

CREATE TABLE in_person_sales (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    seller_user_id UUID REFERENCES app_user (id) ON DELETE SET NULL,
    seller_name VARCHAR(160) NOT NULL,
    sale_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(24) NOT NULL,
    payment_status VARCHAR(40) NOT NULL,
    total NUMERIC(14,2) NOT NULL,
    CONSTRAINT in_person_sales_payment_method_allowed CHECK (payment_method IN ('card', 'transfer')),
    CONSTRAINT in_person_sales_total_nonnegative CHECK (total >= 0)
);
CREATE INDEX in_person_sales_date_idx ON in_person_sales (sale_date DESC);

CREATE TABLE in_person_sale_items (
    sale_record_id UUID NOT NULL REFERENCES in_person_sales (record_id) ON DELETE CASCADE,
    product_record_id UUID NOT NULL REFERENCES products (record_id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(180) NOT NULL,
    sku_snapshot VARCHAR(80) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL,
    line_total NUMERIC(14,2) NOT NULL,
    PRIMARY KEY (sale_record_id, product_record_id),
    CONSTRAINT in_person_sale_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT in_person_sale_items_price_nonnegative CHECK (unit_price >= 0)
);

CREATE TABLE accounting_movements (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    movement_date DATE NOT NULL,
    concept VARCHAR(180) NOT NULL,
    category VARCHAR(100) NOT NULL,
    entry_type VARCHAR(12) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    status VARCHAR(24) NOT NULL,
    created_by UUID REFERENCES app_user (id) ON DELETE SET NULL,
    CONSTRAINT accounting_movements_type_allowed CHECK (entry_type IN ('Ingreso', 'Egreso')),
    CONSTRAINT accounting_movements_status_allowed CHECK (status IN ('Registrado', 'Pendiente', 'Anulado')),
    CONSTRAINT accounting_movements_amount_positive CHECK (amount > 0)
);
CREATE INDEX accounting_movements_date_idx ON accounting_movements (movement_date DESC, status);

CREATE TABLE payment_transactions (
    record_id UUID PRIMARY KEY REFERENCES business_records (id) ON DELETE CASCADE,
    order_record_id UUID REFERENCES commerce_orders (record_id) ON DELETE SET NULL,
    payment_method VARCHAR(24) NOT NULL,
    status VARCHAR(40) NOT NULL,
    reference VARCHAR(80), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_transactions_method_allowed CHECK (payment_method IN ('card', 'transfer'))
);
