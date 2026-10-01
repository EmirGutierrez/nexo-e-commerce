CREATE TABLE business_records (
    id UUID PRIMARY KEY,
    resource_code VARCHAR(40) NOT NULL,
    data JSONB NOT NULL,
    status_code VARCHAR(40),
    created_by UUID REFERENCES app_user (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT business_records_resource_allowed CHECK (resource_code IN (
        'products', 'brands', 'categories', 'customers', 'suppliers', 'orders',
        'purchases', 'sales', 'accounting', 'transfers', 'payments', 'invoices',
        'reports', 'settings', 'profile', 'roles-permissions', 'inventory-alerts'
    )),
    CONSTRAINT business_records_object_data CHECK (jsonb_typeof(data) = 'object')
);

CREATE INDEX business_records_resource_created_idx ON business_records (resource_code, created_at DESC);
CREATE INDEX business_records_resource_status_idx ON business_records (resource_code, status_code);
CREATE INDEX business_records_data_gin_idx ON business_records USING GIN (data jsonb_path_ops);
CREATE UNIQUE INDEX business_records_product_sku_ux ON business_records (LOWER(COALESCE(data ->> 'SKU', data ->> 'sku')))
    WHERE resource_code = 'products' AND COALESCE(data ->> 'SKU', data ->> 'sku') IS NOT NULL;
CREATE UNIQUE INDEX business_records_brand_name_ux ON business_records (LOWER(COALESCE(data ->> 'name', data ->> 'Nombre')))
    WHERE resource_code = 'brands' AND COALESCE(data ->> 'name', data ->> 'Nombre') IS NOT NULL;
CREATE UNIQUE INDEX business_records_category_name_ux ON business_records (LOWER(COALESCE(data ->> 'name', data ->> 'Nombre')))
    WHERE resource_code = 'categories' AND COALESCE(data ->> 'name', data ->> 'Nombre') IS NOT NULL;
CREATE UNIQUE INDEX business_records_customer_email_ux ON business_records (LOWER(COALESCE(data ->> 'email', data ->> 'Correo')))
    WHERE resource_code = 'customers' AND COALESCE(data ->> 'email', data ->> 'Correo') IS NOT NULL;
CREATE UNIQUE INDEX business_records_supplier_name_ux ON business_records (LOWER(COALESCE(data ->> 'name', data ->> 'Empresa')))
    WHERE resource_code = 'suppliers' AND COALESCE(data ->> 'name', data ->> 'Empresa') IS NOT NULL;

CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY,
    product_record_id UUID NOT NULL REFERENCES business_records (id) ON DELETE RESTRICT,
    movement_type VARCHAR(24) NOT NULL,
    quantity_delta INTEGER NOT NULL,
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    reason VARCHAR(240) NOT NULL,
    related_record_id UUID REFERENCES business_records (id) ON DELETE SET NULL,
    actor_id UUID REFERENCES app_user (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT inventory_movements_type_allowed CHECK (movement_type IN ('OPENING', 'PURCHASE', 'SALE', 'ORDER', 'ADJUSTMENT', 'REVERSAL')),
    CONSTRAINT inventory_movements_quantity_nonzero CHECK (quantity_delta <> 0),
    CONSTRAINT inventory_movements_stock_nonnegative CHECK (stock_before >= 0 AND stock_after >= 0),
    CONSTRAINT inventory_movements_delta_matches CHECK (stock_after - stock_before = quantity_delta)
);
CREATE INDEX inventory_movements_product_created_idx ON inventory_movements (product_record_id, created_at DESC);
CREATE INDEX inventory_movements_related_idx ON inventory_movements (related_record_id);

CREATE TABLE business_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_by UUID REFERENCES app_user (id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
