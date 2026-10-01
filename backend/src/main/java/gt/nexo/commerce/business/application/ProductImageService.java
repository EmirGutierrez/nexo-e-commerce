package gt.nexo.commerce.business.application;

import java.sql.ResultSet;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ProductImageService {
    private final JdbcTemplate jdbc;

    public ProductImageService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void save(UUID productId, ImageUpload image) {
        jdbc.update("""
                INSERT INTO product_images (product_record_id, content_type, image_bytes, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (product_record_id) DO UPDATE SET
                    content_type = EXCLUDED.content_type,
                    image_bytes = EXCLUDED.image_bytes,
                    updated_at = CURRENT_TIMESTAMP
                """, productId, image.contentType(), image.bytes());
    }

    public void delete(UUID productId) {
        jdbc.update("DELETE FROM product_images WHERE product_record_id = ?", productId);
    }

    public Optional<StoredImage> find(UUID productId) {
        return jdbc.query("""
                SELECT content_type, image_bytes, updated_at
                FROM product_images WHERE product_record_id = ?
                """, rs -> rs.next()
                ? Optional.of(new StoredImage(rs.getString("content_type"), rs.getBytes("image_bytes"),
                        rs.getTimestamp("updated_at").toInstant()))
                : Optional.empty(), productId);
    }

    public record ImageUpload(String contentType, byte[] bytes) { }

    public record StoredImage(String contentType, byte[] bytes, Instant updatedAt) { }
}
