CREATE TABLE mobile_access_token (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT mobile_access_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT mobile_access_token_expiry_after_creation CHECK (expires_at > created_at),
    CONSTRAINT mobile_access_token_user_fk FOREIGN KEY (user_id)
        REFERENCES app_user (id) ON DELETE CASCADE
);

CREATE INDEX mobile_access_token_user_idx ON mobile_access_token (user_id);
CREATE INDEX mobile_access_token_expiry_idx ON mobile_access_token (expires_at);
