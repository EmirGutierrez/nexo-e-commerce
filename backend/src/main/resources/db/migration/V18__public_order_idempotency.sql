CREATE TABLE public_order_idempotency (
    idempotency_key UUID PRIMARY KEY,
    request_hash CHAR(64) NOT NULL,
    order_record_id UUID UNIQUE REFERENCES business_records(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX public_order_idempotency_created_at_idx ON public_order_idempotency (created_at);
