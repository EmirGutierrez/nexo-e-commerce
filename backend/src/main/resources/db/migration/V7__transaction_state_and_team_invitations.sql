ALTER TABLE in_person_sales
    ADD COLUMN status VARCHAR(24) NOT NULL DEFAULT 'Completado',
    ADD CONSTRAINT in_person_sales_status_allowed CHECK (status IN ('Completado', 'Cancelado'));

ALTER TABLE commerce_orders
    ADD COLUMN customer_phone VARCHAR(40),
    ADD COLUMN delivery_address VARCHAR(500);

CREATE TABLE user_invitations (
    user_id UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    invited_by UUID REFERENCES app_user (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_invitation_expiry_after_creation CHECK (expires_at > created_at)
);
CREATE INDEX user_invitations_expiry_idx ON user_invitations (expires_at) WHERE accepted_at IS NULL;
