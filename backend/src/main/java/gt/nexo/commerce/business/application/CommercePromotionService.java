package gt.nexo.commerce.business.application;

import gt.nexo.commerce.identity.application.PermissionAuthorizer;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommercePromotionService {
    private final JdbcTemplate jdbc;
    private final PermissionAuthorizer permissions;

    public CommercePromotionService(JdbcTemplate jdbc, PermissionAuthorizer permissions) {
        this.jdbc = jdbc;
        this.permissions = permissions;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> publicData() {
        return data(true);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> adminData() {
        authorize("view");
        return data(false);
    }

    @Transactional
    public Map<String, Object> saveData(Map<String, Object> input) {
        authorize("edit");
        List<Map<String, Object>> offers = rows(input, "offers");
        List<Map<String, Object>> announcements = rows(input, "announcements");
        List<Map<String, Object>> codes = rows(input, "discountCodes");
        Set<String> ids = new HashSet<>();
        Set<UUID> offeredProducts = new HashSet<>();
        Set<String> codeNames = new HashSet<>();

        for (Map<String, Object> offer : offers) {
            String id = identifier(offer.get("id"), ids);
            UUID productId = uuid(offer.get("productId"));
            if (!offeredProducts.add(productId)) throw invalid("Solo puede haber una oferta por producto.");
            BigDecimal price = jdbc.query("SELECT price FROM products WHERE record_id = ? AND status <> 'Inactivo'",
                    rs -> rs.next() ? rs.getBigDecimal(1) : null, productId);
            if (price == null) throw invalid("La oferta necesita un producto activo del catálogo.");
            BigDecimal original = money(offer.get("originalPrice"));
            BigDecimal discounted = money(offer.get("discountedPrice"));
            if (original.compareTo(price) != 0 || discounted.signum() <= 0 || discounted.compareTo(price) >= 0)
                throw invalid("La oferta debe usar el precio vigente y un descuento real.");
            dateRange(offer);
            if (!Set.of("Activa", "Pausada").contains(text(offer.get("status")))) throw invalid("El estado de la oferta no es válido.");
            offer.put("id", id);
            offer.put("productId", productId);
            offer.put("originalPrice", original);
            offer.put("discountedPrice", discounted);
        }
        for (Map<String, Object> announcement : announcements) {
            identifier(announcement.get("id"), ids);
            String title = text(announcement.get("title"));
            String description = text(announcement.get("description"));
            String href = text(announcement.get("href"));
            if (title.isBlank() || title.length() > 70 || description.isBlank() || description.length() > 160
                    || href.length() > 500 || !href.startsWith("/") || href.startsWith("//") || href.contains("\\"))
                throw invalid("El anuncio necesita texto y un enlace interno válidos.");
            if (!Set.of("Activa", "Pausada").contains(text(announcement.get("status")))) throw invalid("El estado del anuncio no es válido.");
        }
        for (Map<String, Object> code : codes) {
            identifier(code.get("id"), ids);
            String name = text(code.get("code")).toUpperCase(java.util.Locale.ROOT);
            if (!name.matches("[A-Z0-9-]{3,24}") || !codeNames.add(name)) throw invalid("El código de descuento es inválido o está repetido.");
            int percentage = integer(code.get("discountPercent"));
            int maxUses = integer(code.get("maxUses"));
            BigDecimal minimum = money(code.get("minPurchase"));
            if (percentage < 1 || percentage > 80 || maxUses < 1 || minimum.signum() < 0) throw invalid("Los límites del código no son válidos.");
            dateRange(code);
            if (!Set.of("Activo", "Pausado").contains(text(code.get("status")))) throw invalid("El estado del código no es válido.");
            code.put("code", name);
            code.put("discountPercent", percentage);
            code.put("maxUses", maxUses);
            code.put("minPurchase", minimum);
        }

        Map<String, Integer> previousUses = new HashMap<>();
        jdbc.query("SELECT code, used_count FROM discount_codes FOR UPDATE", rs -> {
            previousUses.put(rs.getString(1), rs.getInt(2));
        });
        for (var entry : previousUses.entrySet()) if (entry.getValue() > 0 && !codeNames.contains(entry.getKey())) {
            throw conflict("Un código ya utilizado se pausa en lugar de eliminarse para conservar su historial.");
        }

        jdbc.update("DELETE FROM product_offers");
        jdbc.update("DELETE FROM store_announcements");
        jdbc.update("DELETE FROM discount_codes");
        for (Map<String, Object> offer : offers) jdbc.update("""
                INSERT INTO product_offers (id, product_record_id, original_price, discounted_price, starts_at, ends_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, offer.get("id"), offer.get("productId"), offer.get("originalPrice"), offer.get("discountedPrice"),
                date(offer.get("startsAt")), date(offer.get("endsAt")), text(offer.get("status")));
        for (Map<String, Object> announcement : announcements) jdbc.update("""
                INSERT INTO store_announcements (id, title, description, href, status) VALUES (?, ?, ?, ?, ?)
                """, text(announcement.get("id")), text(announcement.get("title")), text(announcement.get("description")),
                text(announcement.get("href")), text(announcement.get("status")));
        for (Map<String, Object> code : codes) {
            String name = text(code.get("code"));
            int used = previousUses.getOrDefault(name, 0);
            if (used > (int) code.get("maxUses")) throw conflict("El límite de usos no puede quedar por debajo de los usos registrados.");
            jdbc.update("""
                    INSERT INTO discount_codes (id, code, discount_percent, min_purchase, max_uses, used_count, starts_at, ends_at, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, text(code.get("id")), name, code.get("discountPercent"), code.get("minPurchase"),
                    code.get("maxUses"), used, date(code.get("startsAt")), date(code.get("endsAt")), text(code.get("status")));
        }
        return data(false);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> validateCode(String rawCode, BigDecimal subtotal) {
        String code = text(rawCode).toUpperCase(java.util.Locale.ROOT);
        Map<String, Object> row = jdbc.query("""
                SELECT code, discount_percent, min_purchase, max_uses, used_count, starts_at, ends_at, status
                FROM discount_codes WHERE code = ?
                """, rs -> rs.next() ? Map.of(
                "code", rs.getString("code"), "discountPercent", rs.getInt("discount_percent"),
                "minPurchase", rs.getBigDecimal("min_purchase"), "maxUses", rs.getInt("max_uses"),
                "usedCount", rs.getInt("used_count"), "startsAt", rs.getDate("starts_at").toLocalDate(),
                "endsAt", rs.getDate("ends_at").toLocalDate(), "status", rs.getString("status")) : null, code);
        String reason = invalidCodeReason(row, subtotal);
        if (reason != null) return Map.of("valid", false, "message", reason);
        BigDecimal discount = subtotal.multiply(BigDecimal.valueOf((int) row.get("discountPercent")))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        return Map.of("valid", true, "code", row, "discount", discount);
    }

    public BigDecimal useCode(String rawCode, BigDecimal subtotal) {
        String code = text(rawCode).toUpperCase(java.util.Locale.ROOT);
        if (code.isBlank()) return BigDecimal.ZERO;
        Map<String, Object> row = jdbc.query("""
                SELECT code, discount_percent, min_purchase, max_uses, used_count, starts_at, ends_at, status
                FROM discount_codes WHERE code = ? FOR UPDATE
                """, rs -> rs.next() ? Map.of(
                "code", rs.getString("code"), "discountPercent", rs.getInt("discount_percent"),
                "minPurchase", rs.getBigDecimal("min_purchase"), "maxUses", rs.getInt("max_uses"),
                "usedCount", rs.getInt("used_count"), "startsAt", rs.getDate("starts_at").toLocalDate(),
                "endsAt", rs.getDate("ends_at").toLocalDate(), "status", rs.getString("status")) : null, code);
        String reason = invalidCodeReason(row, subtotal);
        if (reason != null) throw conflict(reason);
        BigDecimal discount = subtotal.multiply(BigDecimal.valueOf((int) row.get("discountPercent")))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        jdbc.update("UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?", code);
        return discount;
    }

    @Transactional(readOnly = true)
    public BigDecimal priceForProduct(UUID productId, BigDecimal basePrice) {
        BigDecimal offered = jdbc.query("""
                SELECT discounted_price FROM product_offers WHERE product_record_id = ? AND status = 'Activa'
                AND starts_at <= CURRENT_DATE AND ends_at >= CURRENT_DATE AND original_price = ?
                """, rs -> rs.next() ? rs.getBigDecimal(1) : null, productId, basePrice);
        return offered != null && offered.compareTo(basePrice) < 0 ? offered : basePrice;
    }

    private Map<String, Object> data(boolean publicOnly) {
        String offerFilter = publicOnly ? " WHERE o.status = 'Activa' AND o.starts_at <= CURRENT_DATE AND o.ends_at >= CURRENT_DATE AND p.status <> 'Inactivo' AND p.price = o.original_price" : "";
        List<Map<String, Object>> offers = jdbc.query("""
                SELECT o.id, o.product_record_id, o.original_price, o.discounted_price, o.starts_at, o.ends_at, o.status
                FROM product_offers o JOIN products p ON p.record_id = o.product_record_id
                """ + offerFilter + " ORDER BY o.id", (rs, row) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getString("id")); item.put("productId", rs.getObject("product_record_id", UUID.class).toString());
            item.put("originalPrice", rs.getBigDecimal("original_price")); item.put("discountedPrice", rs.getBigDecimal("discounted_price"));
            item.put("startsAt", rs.getDate("starts_at").toLocalDate().toString()); item.put("endsAt", rs.getDate("ends_at").toLocalDate().toString());
            item.put("status", rs.getString("status")); return item;
        });
        List<Map<String, Object>> announcements = jdbc.query("""
                SELECT id, title, description, href, status FROM store_announcements
                """ + (publicOnly ? " WHERE status = 'Activa'" : "") + " ORDER BY id", (rs, row) -> Map.of(
                "id", rs.getString("id"), "title", rs.getString("title"), "description", rs.getString("description"),
                "href", rs.getString("href"), "status", rs.getString("status")));
        List<Map<String, Object>> codes = publicOnly ? List.of() : jdbc.query("""
                SELECT id, code, discount_percent, min_purchase, max_uses, used_count, starts_at, ends_at, status
                FROM discount_codes ORDER BY code
                """, (rs, row) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getString("id")); item.put("code", rs.getString("code")); item.put("discountPercent", rs.getInt("discount_percent"));
            item.put("minPurchase", rs.getBigDecimal("min_purchase")); item.put("maxUses", rs.getInt("max_uses"));
            item.put("usedCount", rs.getInt("used_count")); item.put("startsAt", rs.getDate("starts_at").toLocalDate().toString());
            item.put("endsAt", rs.getDate("ends_at").toLocalDate().toString()); item.put("status", rs.getString("status")); return item;
        });
        return Map.of("offers", offers, "announcements", announcements, "discountCodes", codes);
    }

    private String invalidCodeReason(Map<String, Object> row, BigDecimal subtotal) {
        if (row == null) return "El código no existe.";
        LocalDate today = LocalDate.now();
        if (!"Activo".equals(row.get("status")) || today.isBefore((LocalDate) row.get("startsAt")) || today.isAfter((LocalDate) row.get("endsAt")))
            return "El código no está activo.";
        if ((int) row.get("usedCount") >= (int) row.get("maxUses")) return "El código alcanzó su límite de usos.";
        if (subtotal.compareTo((BigDecimal) row.get("minPurchase")) < 0) return "No se alcanzó la compra mínima del código.";
        return null;
    }

    private void authorize(String action) {
        if (!permissions.has(SecurityContextHolder.getContext().getAuthentication(), "promotions", action))
            throw new AccessDeniedException("Permiso requerido: promotions:" + action);
    }

    private static List<Map<String, Object>> rows(Map<String, Object> input, String key) {
        if (input == null || !(input.get(key) instanceof List<?> values) || values.size() > 500)
            throw invalid("La lista de " + key + " no es válida.");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object value : values) {
            if (!(value instanceof Map<?, ?> row)) throw invalid("Un registro de " + key + " no es válido.");
            Map<String, Object> mapped = new LinkedHashMap<>();
            row.forEach((field, item) -> mapped.put(String.valueOf(field), item));
            result.add(mapped);
        }
        return result;
    }

    private static String identifier(Object value, Set<String> ids) {
        String id = text(value);
        if (!id.matches("[A-Za-z0-9_-]{1,80}") || !ids.add(id)) throw invalid("El identificador de una promoción es inválido o está repetido.");
        return id;
    }

    private static UUID uuid(Object value) {
        try { return UUID.fromString(text(value)); }
        catch (Exception exception) { throw invalid("El producto de la oferta no es válido."); }
    }

    private static void dateRange(Map<String, Object> row) {
        if (date(row.get("startsAt")).isAfter(date(row.get("endsAt")))) throw invalid("La fecha inicial debe ser anterior al vencimiento.");
    }

    private static LocalDate date(Object value) {
        try { return LocalDate.parse(text(value)); }
        catch (Exception exception) { throw invalid("La fecha de la promoción no es válida."); }
    }

    private static BigDecimal money(Object value) {
        try { return new BigDecimal(text(value)).setScale(2, RoundingMode.HALF_UP); }
        catch (Exception exception) { throw invalid("El importe de la promoción no es válido."); }
    }

    private static int integer(Object value) {
        try { return new BigDecimal(text(value)).intValueExact(); }
        catch (Exception exception) { throw invalid("El número de usos o descuento no es válido."); }
    }

    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static BusinessRuleException invalid(String message) { return new BusinessRuleException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message); }
    private static BusinessRuleException conflict(String message) { return new BusinessRuleException(HttpStatus.CONFLICT, "BUSINESS_RULE_VIOLATION", message); }
}
