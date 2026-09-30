CREATE TABLE roles (
    code VARCHAR(40) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description VARCHAR(240),
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT roles_code_lowercase CHECK (code = LOWER(code)),
    CONSTRAINT roles_display_name_nonempty CHECK (LENGTH(BTRIM(display_name)) > 0)
);

CREATE TABLE permissions (
    module_code VARCHAR(40) NOT NULL,
    action_code VARCHAR(24) NOT NULL,
    PRIMARY KEY (module_code, action_code),
    CONSTRAINT permissions_module_allowed CHECK (
        module_code IN ('dashboard', 'products', 'inventory', 'orders', 'sales', 'customers', 'suppliers', 'reports', 'settings', 'users')
    ),
    CONSTRAINT permissions_action_allowed CHECK (action_code IN ('view', 'create', 'edit', 'delete', 'approve'))
);

CREATE TABLE role_permissions (
    role_code VARCHAR(40) NOT NULL,
    module_code VARCHAR(40) NOT NULL,
    action_code VARCHAR(24) NOT NULL,
    PRIMARY KEY (role_code, module_code, action_code),
    CONSTRAINT role_permissions_role_fk FOREIGN KEY (role_code) REFERENCES roles (code) ON DELETE CASCADE,
    CONSTRAINT role_permissions_permission_fk FOREIGN KEY (module_code, action_code)
        REFERENCES permissions (module_code, action_code) ON DELETE CASCADE
);

CREATE TABLE app_user (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    display_name VARCHAR(160) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_code VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT app_user_email_unique UNIQUE (email),
    CONSTRAINT app_user_email_normalized CHECK (email = LOWER(BTRIM(email))),
    CONSTRAINT app_user_email_nonempty CHECK (LENGTH(email) > 0),
    CONSTRAINT app_user_display_name_nonempty CHECK (LENGTH(BTRIM(display_name)) > 0),
    CONSTRAINT app_user_password_hash_nonempty CHECK (LENGTH(password_hash) > 0),
    CONSTRAINT app_user_status_allowed CHECK (status IN ('PENDING', 'ACTIVE', 'LOCKED', 'DISABLED')),
    CONSTRAINT app_user_failed_attempts_nonnegative CHECK (failed_login_attempts >= 0),
    CONSTRAINT app_user_role_fk FOREIGN KEY (role_code) REFERENCES roles (code) ON DELETE RESTRICT
);

CREATE INDEX app_user_role_code_idx ON app_user (role_code);
CREATE INDEX app_user_status_created_at_idx ON app_user (status, created_at DESC);

INSERT INTO roles (code, display_name, description) VALUES
    ('superadmin', 'Súper Administrador', 'Acceso completo protegido del sistema.'),
    ('admin', 'Administrador', 'Administración de la operación.'),
    ('sales', 'Vendedor', 'Atención de clientes, pedidos y ventas.'),
    ('warehouse', 'Personal de bodega', 'Operaciones de inventario y abastecimiento.'),
    ('employee', 'Empleado', 'Cuenta de personal sin permisos asignados inicialmente.');

INSERT INTO permissions (module_code, action_code) VALUES
    ('dashboard', 'view'),
    ('products', 'view'), ('products', 'create'), ('products', 'edit'), ('products', 'delete'),
    ('inventory', 'view'), ('inventory', 'create'), ('inventory', 'edit'), ('inventory', 'approve'),
    ('orders', 'view'), ('orders', 'edit'), ('orders', 'approve'),
    ('sales', 'view'), ('sales', 'create'), ('sales', 'edit'), ('sales', 'approve'),
    ('customers', 'view'), ('customers', 'create'), ('customers', 'edit'), ('customers', 'delete'),
    ('suppliers', 'view'), ('suppliers', 'create'), ('suppliers', 'edit'), ('suppliers', 'delete'),
    ('reports', 'view'), ('reports', 'create'),
    ('settings', 'view'), ('settings', 'edit'),
    ('users', 'view'), ('users', 'create'), ('users', 'edit'), ('users', 'delete');

INSERT INTO role_permissions (role_code, module_code, action_code)
SELECT role_code, module_code, action_code
FROM permissions
CROSS JOIN (VALUES ('superadmin'), ('admin')) AS full_roles(role_code);

INSERT INTO role_permissions (role_code, module_code, action_code) VALUES
    ('sales', 'dashboard', 'view'),
    ('sales', 'products', 'view'),
    ('sales', 'orders', 'view'), ('sales', 'orders', 'edit'), ('sales', 'orders', 'approve'),
    ('sales', 'sales', 'view'), ('sales', 'sales', 'create'), ('sales', 'sales', 'edit'),
    ('sales', 'customers', 'view'), ('sales', 'customers', 'create'), ('sales', 'customers', 'edit'),
    ('sales', 'reports', 'view'), ('sales', 'reports', 'create'),
    ('warehouse', 'dashboard', 'view'),
    ('warehouse', 'products', 'view'),
    ('warehouse', 'inventory', 'view'), ('warehouse', 'inventory', 'create'), ('warehouse', 'inventory', 'edit'),
    ('warehouse', 'orders', 'view'),
    ('warehouse', 'suppliers', 'view'), ('warehouse', 'suppliers', 'create'), ('warehouse', 'suppliers', 'edit'),
    ('warehouse', 'reports', 'view');
