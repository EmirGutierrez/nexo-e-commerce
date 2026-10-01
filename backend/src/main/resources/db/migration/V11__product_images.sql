CREATE TABLE product_images (
    product_record_id UUID PRIMARY KEY REFERENCES products (record_id) ON DELETE CASCADE,
    content_type VARCHAR(32) NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    image_bytes BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT product_image_size_allowed CHECK (octet_length(image_bytes) BETWEEN 16 AND 143360)
);
