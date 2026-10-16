INSERT INTO permissions (module_code, action_code)
VALUES ('inventory', 'delete')
ON CONFLICT (module_code, action_code) DO NOTHING;

INSERT INTO role_permissions (role_code, module_code, action_code)
SELECT code, 'inventory', 'delete'
FROM roles
WHERE code IN ('superadmin', 'admin')
ON CONFLICT (role_code, module_code, action_code) DO NOTHING;
