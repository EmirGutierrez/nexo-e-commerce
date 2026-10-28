CREATE TABLE password_reset_tokens (
    user_id UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT password_reset_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT password_reset_token_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX password_reset_tokens_expiry_idx ON password_reset_tokens (expires_at);
