CREATE SEQUENCE product_sku_number_seq AS BIGINT START WITH 1;

SELECT setval(
    'product_sku_number_seq',
    GREATEST(COALESCE(MAX(CASE WHEN sku ~ '^NEXO-[0-9]{6,}$' THEN substring(sku FROM 6)::BIGINT END), 1), 1),
    COALESCE(MAX(CASE WHEN sku ~ '^NEXO-[0-9]{6,}$' THEN substring(sku FROM 6)::BIGINT END), 0) > 0
)
FROM products;

INSERT INTO business_records (id, resource_code, data, status_code)
SELECT gen_random_uuid(), 'categories', jsonb_build_object('name', product.category_name, 'status', 'Activo'), 'Activo'
FROM (SELECT DISTINCT BTRIM(category_name) AS category_name FROM products WHERE BTRIM(category_name) <> '') product
WHERE NOT EXISTS (
    SELECT 1 FROM business_records category
    WHERE category.resource_code = 'categories'
      AND LOWER(COALESCE(category.data ->> 'name', category.data ->> 'Nombre')) = LOWER(BTRIM(product.category_name))
)
ON CONFLICT DO NOTHING;

INSERT INTO product_categories (record_id, name, status)
SELECT DISTINCT ON (LOWER(COALESCE(category.data ->> 'name', category.data ->> 'Nombre')))
       category.id,
       COALESCE(category.data ->> 'name', category.data ->> 'Nombre'),
       COALESCE(category.data ->> 'status', category.data ->> 'Estado', 'Activo')
FROM business_records category
JOIN (SELECT DISTINCT BTRIM(category_name) AS category_name FROM products WHERE BTRIM(category_name) <> '') product
  ON LOWER(COALESCE(category.data ->> 'name', category.data ->> 'Nombre')) = LOWER(product.category_name)
WHERE category.resource_code = 'categories'
ORDER BY LOWER(COALESCE(category.data ->> 'name', category.data ->> 'Nombre')), category.created_at, category.id
ON CONFLICT DO NOTHING;

UPDATE products product
SET category_record_id = category.record_id
FROM product_categories category
WHERE product.category_record_id IS NULL
  AND LOWER(product.category_name) = LOWER(category.name);

INSERT INTO roles (code, display_name, description)
VALUES ('employee_buyer', 'Empleado comprador', 'Acceso exclusivo a la creación de pedidos desde el catálogo.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_code, module_code, action_code)
VALUES ('employee_buyer', 'orders', 'create')
ON CONFLICT DO NOTHING;
