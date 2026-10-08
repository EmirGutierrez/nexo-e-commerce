DELETE FROM business_records
WHERE resource_code = 'reports';

DELETE FROM permissions
WHERE module_code = 'reports';

ALTER TABLE permissions DROP CONSTRAINT permissions_module_allowed;
ALTER TABLE permissions ADD CONSTRAINT permissions_module_allowed CHECK (
    module_code IN ('dashboard', 'products', 'inventory', 'orders', 'sales', 'customers',
                    'suppliers', 'accounting', 'promotions', 'settings', 'users')
);
