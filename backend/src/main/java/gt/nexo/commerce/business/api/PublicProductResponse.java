package gt.nexo.commerce.business.api;

import java.math.BigDecimal;
import java.util.Map;

/** Public allow-list for catalog data. Keep internal inventory and cost fields out of this response. */
public record PublicProductResponse(
        String id,
        String brandId,
        String name,
        String category,
        BigDecimal price,
        BigDecimal compareAt,
        Integer stock,
        String status,
        String image,
        String description,
        Boolean featured,
        String sku) {

    public static PublicProductResponse from(Map<String, Object> product) {
        return new PublicProductResponse(
                string(product.get("id")),
                string(product.get("brandId")),
                string(product.get("name")),
                string(product.get("category")),
                decimal(product.get("price")),
                decimal(product.get("compareAt")),
                integer(product.get("stock")),
                string(product.get("status")),
                string(product.get("image")),
                string(product.get("description")),
                bool(product.get("featured")),
                string(product.get("sku")));
    }

    private static String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static BigDecimal decimal(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try { return value instanceof BigDecimal amount ? amount : new BigDecimal(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return null; }
    }

    private static Integer integer(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try { return value instanceof Number number ? number.intValue() : Integer.valueOf(String.valueOf(value)); }
        catch (NumberFormatException ignored) { return null; }
    }

    private static Boolean bool(Object value) {
        if (value == null) return null;
        if (value instanceof Boolean flag) return flag;
        return Boolean.valueOf(String.valueOf(value));
    }
}
