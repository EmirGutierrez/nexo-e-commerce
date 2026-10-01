INSERT INTO permissions (module_code, action_code)
VALUES ('orders', 'create')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, module_code, action_code)
VALUES
    ('superadmin', 'orders', 'create'),
    ('admin', 'orders', 'create'),
    ('sales', 'orders', 'create')
ON CONFLICT DO NOTHING;
