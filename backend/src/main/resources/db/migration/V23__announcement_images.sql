ALTER TABLE store_announcements
    ADD COLUMN image_data_url TEXT;

ALTER TABLE store_announcements
    ADD CONSTRAINT store_announcements_image_data_url_size_check
        CHECK (image_data_url IS NULL OR length(image_data_url) <= 250000);
