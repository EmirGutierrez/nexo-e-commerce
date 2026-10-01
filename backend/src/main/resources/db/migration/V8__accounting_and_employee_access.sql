ALTER TABLE permissions DROP CONSTRAINT permissions_module_allowed;
ALTER TABLE permissions ADD CONSTRAINT permissions_module_allowed CHECK (
    module_code IN ('dashboard', 'products', 'inventory', 'orders', 'sales', 'customers', 'suppliers', 'reports', 'accounting', 'settings', 'users')
);

INSERT INTO permissions (module_code, action_code) VALUES
    ('accounting', 'view'), ('accounting', 'create'), ('accounting', 'edit')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, module_code, action_code)
SELECT role_code, 'accounting', action_code
FROM (VALUES ('superadmin'), ('admin')) AS full_roles(role_code)
CROSS JOIN (VALUES ('view'), ('create'), ('edit')) AS actions(action_code)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, module_code, action_code) VALUES
    ('employee', 'dashboard', 'view'),
    ('employee', 'products', 'view'),
    ('employee', 'inventory', 'view'),
    ('employee', 'sales', 'view'),
    ('employee', 'sales', 'create')
ON CONFLICT DO NOTHING;
