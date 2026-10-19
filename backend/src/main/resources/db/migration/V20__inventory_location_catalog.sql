CREATE TABLE inventory_locations (
    location_name TEXT PRIMARY KEY,
    normalized_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT inventory_locations_name_not_blank CHECK (BTRIM(location_name) <> '')
);

WITH existing_locations AS (
    SELECT COALESCE(NULLIF(BTRIM(data ->> 'location'), ''), BTRIM(data ->> 'Ubicación')) AS location_name
    FROM business_records
    WHERE resource_code = 'products'
), normalized_locations AS (
    SELECT location_name, LOWER(location_name) AS normalized_name
    FROM existing_locations
    WHERE NULLIF(location_name, '') IS NOT NULL
)
INSERT INTO inventory_locations (location_name, normalized_name)
SELECT DISTINCT ON (normalized_name) location_name, normalized_name
FROM normalized_locations
ORDER BY normalized_name, location_name;
