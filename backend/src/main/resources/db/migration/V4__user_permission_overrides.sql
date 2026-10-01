CREATE TABLE user_permissions (
    user_id UUID NOT NULL,
    module_code VARCHAR(40) NOT NULL,
    action_code VARCHAR(24) NOT NULL,
    granted BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, module_code, action_code),
    CONSTRAINT user_permissions_user_fk
        FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT user_permissions_permission_fk
        FOREIGN KEY (module_code, action_code)
        REFERENCES permissions (module_code, action_code) ON DELETE CASCADE
);

CREATE INDEX user_permissions_permission_idx
    ON user_permissions (module_code, action_code, granted, user_id);
