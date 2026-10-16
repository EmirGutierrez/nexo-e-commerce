CREATE TABLE app_user_mfa (
    user_id UUID PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    secret_ciphertext BYTEA NOT NULL,
    enabled_at TIMESTAMPTZ,
    last_used_step BIGINT NOT NULL DEFAULT -1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_user_mfa_recovery_code (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user_mfa(user_id) ON DELETE CASCADE,
    code_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_app_user_mfa_recovery_code UNIQUE (user_id, code_hash)
);

CREATE INDEX ix_app_user_mfa_recovery_code_user ON app_user_mfa_recovery_code(user_id);
