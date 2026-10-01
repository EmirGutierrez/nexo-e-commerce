package gt.nexo.commerce.business.application;

import gt.nexo.commerce.business.api.BusinessRecordResponse;
import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import gt.nexo.commerce.identity.application.PermissionAuthorizer;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class BusinessRecordService {
    private static final Set<String> RESOURCES = Set.of(
            "products", "brands", "categories", "customers", "suppliers", "orders", "purchases",
            "sales", "accounting", "transfers", "payments", "invoices", "reports", "settings",
            "profile", "roles-permissions", "inventory-alerts");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final PermissionAuthorizer permissions;
    private final CommercePromotionService promotions;

    public BusinessRecordService(JdbcTemplate jdbc, ObjectMapper mapper, PermissionAuthorizer permissions,
                                 CommercePromotionService promotions) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.permissions = permissions;
        this.promotions = promotions;
    }

    @Transactional(readOnly = true)
    public List<BusinessRecordResponse> list(String resource) {
        String normalized = normalize(resource);
        authorize(normalized, "view");
        List<BusinessRecordResponse> records = jdbc.query("""
                SELECT id, resource_code, data::text AS data, created_at, updated_at
                FROM business_records WHERE resource_code = ? ORDER BY created_at DESC, id
                """, (rs, row) -> new BusinessRecordResponse(
                rs.getObject("id", UUID.class), rs.getString("resource_code"), readMap(rs.getString("data")),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant()), normalized);
        if (normalized.equals("categories")) return records.stream().map(record -> {
            Map<String, Object> data = new LinkedHashMap<>(record.data());
            long productCount = jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE category_record_id = ?", Long.class, record.id());
            data.put("products", productCount);
            return new BusinessRecordResponse(record.id(), record.resource(), data, record.createdAt(), record.updatedAt());
        }).toList();
        if (!normalized.equals("customers")) return records;
        return records.stream().map(record -> {
            Map<String, Object> data = new LinkedHashMap<>(record.data());
            String email = text(data.get("email"));
            Map<String, Object> totals = jdbc.query("""
                    SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS purchased FROM commerce_orders
                    WHERE LOWER(COALESCE(customer_email, '')) = LOWER(?) AND status <> 'Cancelado'
                    """, rs -> { rs.next(); return Map.of("orders", rs.getLong("orders"), "totalPurchased", rs.getBigDecimal("purchased")); }, email);
            data.putAll(totals);
            return new BusinessRecordResponse(record.id(), record.resource(), data, record.createdAt(), record.updatedAt());
        }).toList();
    }

    @Transactional
    public BusinessRecordResponse create(String resource, Map<String, Object> input) {
        String normalized = normalize(resource);
        authorize(normalized, "create");
        if (normalized.equals("orders") || normalized.equals("sales") || Set.of("transfers", "payments", "invoices", "settings", "profile", "roles-permissions", "inventory-alerts").contains(normalized))
            throw invalid("Este módulo requiere su flujo de negocio específico.");
        Map<String, Object> data = clean(input);
        if (normalized.equals("reports")) data = buildReport(data, actorId());
        validate(normalized, data);
        ensureUnique(normalized, data, null);
        UUID id = normalized.equals("customers") ? customerRecordId(data) : UUID.randomUUID();
        if (jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM business_records WHERE id = ?)", Boolean.class, id)) {
            throw conflict("El perfil del cliente ya está registrado.");
        }
        UUID actor = actorId();
        Instant now = Instant.now();
        jdbc.update("""
                INSERT INTO business_records (id, resource_code, data, status_code, created_by)
                VALUES (?, ?, ?::jsonb, ?, ?)
                """, id, normalized, writeJson(data), statusOf(data), actor);
        syncProjection(id, normalized, data, actor);
        jdbc.update("UPDATE business_records SET data = ?::jsonb, status_code = ? WHERE id = ?", writeJson(data), statusOf(data), id);
        if (normalized.equals("products") && number(field(data, "stock", "Existencias"), 0) > 0) {
            int initialStock = number(field(data, "stock", "Existencias"), 0);
            inventoryMovement(id, "OPENING", initialStock, 0, initialStock, "Existencia inicial", null, actor);
        }
        if (normalized.equals("purchases")) applyPurchase(id, data, actor);
        return new BusinessRecordResponse(id, normalized, data, now, now);
    }

    @Transactional
    public BusinessRecordResponse update(String resource, UUID id, Map<String, Object> input) {
        String normalized = normalize(resource);
        authorize(normalized, "edit");
        if (Set.of("reports", "transfers", "payments", "invoices", "settings", "profile", "roles-permissions", "inventory-alerts").contains(normalized))
            throw invalid("Este registro no admite edición directa.");
        Map<String, Object> data = clean(input);
        Map<String, Object> old = lockedRecord(normalized, id);
        validate(normalized, data);
        ensureUnique(normalized, data, id);
        if (normalized.equals("categories")) {
            String previousName = text(field(old, "name", "Nombre"));
            String nextName = text(field(data, "name", "Nombre"));
            if (!previousName.equals(nextName)) {
                jdbc.update("UPDATE products SET category_name = ? WHERE category_record_id = ?", nextName, id);
                jdbc.update("""
                        UPDATE business_records SET data = jsonb_set(data, '{category}', to_jsonb(?::text)),
                        updated_at = CURRENT_TIMESTAMP WHERE id IN
                        (SELECT record_id FROM products WHERE category_record_id = ?)
                        """, nextName, id);
            }
        }
        if (normalized.equals("products")) {
            int before = number(field(old, "stock", "Existencias"), 0);
            int after = number(field(data, "stock", "Existencias"), before);
            if (after < 0) throw invalid("Las existencias no pueden ser negativas.");
            if (after != before) inventoryMovement(id, "ADJUSTMENT", after - before, before, after,
                    "Ajuste manual desde inventario", null, actorId());
        }
        if (normalized.equals("purchases")) transitionPurchase(id, old, data, actorId());
        if (normalized.equals("orders")) {
            if (!sameOrderContents(old, data)) throw conflict("Los datos, productos e importes de un pedido no se pueden modificar después de confirmarlo.");
            if (!java.util.Objects.equals(old.get("paymentStatus"), data.get("paymentStatus")))
                throw conflict("El estado del pago se cambia mediante la revisión del comprobante.");
            String receiptStatus = jdbc.query("SELECT status FROM transfer_receipts WHERE order_record_id = ?",
                    rs -> rs.next() ? rs.getString(1) : null, id);
            if ("Pendiente".equals(receiptStatus) && !java.util.Objects.equals(old.get("status"), data.get("status")))
                throw conflict("Debes revisar el comprobante antes de cambiar el pedido.");
            transitionOrder(id, old, data, actorId());
        }
        if (normalized.equals("sales")) {
            for (String key : List.of("date", "seller", "paymentMethod", "paymentStatus", "total", "items"))
                if (!java.util.Objects.equals(old.get(key), data.get(key)))
                    throw conflict("Los artículos e importes de una venta no pueden modificarse después de registrarse.");
            transitionSale(id, old, data, actorId());
        }
        if (normalized.equals("accounting")) transitionAccounting(old, data);
        int updated = jdbc.update("""
                UPDATE business_records SET data = ?::jsonb, status_code = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND resource_code = ?
                """, writeJson(data), statusOf(data), id, normalized);
        if (updated == 0) throw missing();
        syncProjection(id, normalized, data, actorId());
        jdbc.update("UPDATE business_records SET data = ?::jsonb, status_code = ? WHERE id = ?", writeJson(data), statusOf(data), id);
        var timestamps = jdbc.queryForMap("SELECT created_at, updated_at FROM business_records WHERE id = ?", id);
        return new BusinessRecordResponse(id, normalized, data,
                ((java.sql.Timestamp) timestamps.get("created_at")).toInstant(),
                ((java.sql.Timestamp) timestamps.get("updated_at")).toInstant());
    }

    @Transactional
    public void delete(String resource, UUID id) {
        String normalized = normalize(resource);
        authorize(normalized, "delete");
        if (Set.of("orders", "purchases", "sales", "accounting", "reports", "transfers", "payments", "invoices", "settings", "profile", "roles-permissions", "inventory-alerts").contains(normalized))
            throw conflict("El historial de esta operación no se puede eliminar.");
        Map<String, Object> old = lockedRecord(normalized, id);
        if (normalized.equals("products") && jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM inventory_movements WHERE product_record_id = ?)", Boolean.class, id)) {
            throw conflict("El producto tiene historial de inventario; desactívalo para conservar la trazabilidad.");
        }
        if (normalized.equals("brands")) {
            String brandName = String.valueOf(field(old, "name", "Nombre"));
            Boolean linked = jdbc.queryForObject("""
                    SELECT EXISTS (SELECT 1 FROM business_records WHERE resource_code = 'products'
                    AND LOWER(COALESCE(data ->> 'brandId', data ->> 'Marca', '')) = LOWER(?))
                    """, Boolean.class, id.toString());
            if (Boolean.TRUE.equals(linked)) throw conflict("La marca todavía tiene productos asociados.");
        }
        if (normalized.equals("categories")) {
            Long linkedProducts = jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE category_record_id = ?", Long.class, id);
            if (linkedProducts != null && linkedProducts > 0) throw conflict("La categoría tiene productos relacionados.");
        }
        if (normalized.equals("suppliers")) {
            Boolean linked = jdbc.queryForObject("""
                    SELECT EXISTS (SELECT 1 FROM business_records WHERE resource_code = 'purchases'
                    AND COALESCE(data ->> 'supplierId', '') = ? AND COALESCE(data ->> 'status', data ->> 'Estado', '') <> 'Anulada')
                    """, Boolean.class, id.toString());
            if (Boolean.TRUE.equals(linked)) throw conflict("El proveedor tiene compras relacionadas; archívalo para conservar el historial.");
        }
        if (normalized.equals("customers")) {
            Boolean isAccount = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM app_user WHERE id = ?)", Boolean.class, id);
            if (Boolean.TRUE.equals(isAccount)) throw conflict("Este cliente tiene una cuenta de acceso; desactívala sin borrar su perfil.");
        }
        jdbc.update("DELETE FROM business_records WHERE id = ? AND resource_code = ?", id, normalized);
    }

    @Transactional
    public BusinessRecordResponse createInPersonSale(Map<String, Object> input) {
        authorize("sales", "create");
        List<?> rawItems = input.get("items") instanceof List<?> list ? list : List.of();
        if (rawItems.isEmpty()) throw invalid("Agrega al menos un producto para registrar la venta.");
        String method = String.valueOf(input.getOrDefault("paymentMethod", ""));
        if (!Set.of("card", "transfer").contains(method)) throw invalid("El método de pago no es válido.");
        if (!paymentEnabled(method)) throw conflict("El método de pago seleccionado está desactivado.");

        Map<UUID, Integer> quantities = new LinkedHashMap<>();
        for (Object item : rawItems) {
            if (!(item instanceof Map<?, ?> map)) throw invalid("Uno de los artículos no es válido.");
            UUID productId = parseUuid(map.get("productId"));
            int quantity = number(map.get("quantity"), 0);
            if (quantity < 1) throw invalid("Las cantidades deben ser enteros mayores que cero.");
            quantities.merge(productId, quantity, Integer::sum);
        }

        UUID saleId = UUID.randomUUID();
        UUID actor = actorId();
        List<Map<String, Object>> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (var entry : quantities.entrySet()) {
            Map<String, Object> product = lockedRecord("products", entry.getKey());
            int stock = number(field(product, "stock", "Existencias"), 0);
            if (Set.of("Inactivo", "Inactive", "DISABLED").contains(String.valueOf(field(product, "status", "Estado")))) throw conflict("El producto " + field(product, "name", "Producto") + " está inactivo.");
            int quantity = entry.getValue();
            if (quantity > stock) throw conflict("Stock insuficiente para " + field(product, "name", "Producto") + ". Disponible: " + stock + ".");
            BigDecimal price = decimal(field(product, "price", "Valor"));
            BigDecimal line = price.multiply(BigDecimal.valueOf(quantity));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("productId", entry.getKey().toString());
            item.put("productName", field(product, "name", "Producto"));
            item.put("sku", field(product, "sku", "SKU"));
            item.put("quantity", quantity);
            item.put("unitPrice", price);
            item.put("subtotal", line);
            items.add(item);
            total = total.add(line);
        }
        Instant now = Instant.now();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("date", now.toString());
        data.put("seller", principalName());
        data.put("paymentMethod", method);
        data.put("paymentStatus", method.equals("card") ? "Simulada" : "Pendiente de verificación");
        data.put("status", "Completado");
        data.put("items", items);
        data.put("total", total);
        jdbc.update("INSERT INTO business_records (id, resource_code, data, status_code, created_by) VALUES (?, 'sales', ?::jsonb, ?, ?)",
                saleId, writeJson(data), data.get("paymentStatus"), actor);
        syncProjection(saleId, "sales", data, actor);
        for (var entry : quantities.entrySet()) changeStock(entry.getKey(), -entry.getValue(), "SALE", "Venta presencial " + saleId, saleId, actor);
        return new BusinessRecordResponse(saleId, "sales", data, now, now);
    }

    @Transactional
    public BusinessRecordResponse createPublicOrder(Map<String, Object> input) {
        String customerName = text(input.get("customerName"));
        String customerEmail = text(input.get("customerEmail")).toLowerCase(Locale.ROOT);
        String paymentMethod = text(input.get("paymentMethod"));
        String address = text(input.get("address"));
        if (customerName.isBlank() || customerName.length() > 160) throw invalid("Ingresa el nombre de quien recibe el pedido.");
        if (!customerEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw invalid("Ingresa un correo válido para el pedido.");
        if (address.isBlank() || address.length() > 500) throw invalid("Ingresa una dirección de entrega válida.");
        if (!Set.of("card", "transfer").contains(paymentMethod) || !paymentEnabled(paymentMethod)) throw conflict("El método de pago ya no está disponible.");
        List<?> rawItems = input.get("items") instanceof List<?> list ? list : List.of();
        if (rawItems.isEmpty()) throw invalid("El pedido debe incluir al menos un producto.");
        Map<UUID, Integer> quantities = new LinkedHashMap<>();
        for (Object item : rawItems) {
            if (!(item instanceof Map<?, ?> row)) throw invalid("Uno de los artículos del pedido no es válido.");
            UUID productId = parseUuid(row.get("productId"));
            int quantity = number(row.get("quantity"), 0);
            if (quantity < 1 || quantity > 100) throw invalid("La cantidad de cada producto debe estar entre 1 y 100.");
            quantities.merge(productId, quantity, Integer::sum);
        }
        List<Map<String, Object>> orderItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var entry : quantities.entrySet()) {
            Map<String, Object> product = lockedRecord("products", entry.getKey());
            if (Set.of("Inactivo", "Inactive", "DISABLED").contains(String.valueOf(field(product, "status", "Estado")))) throw conflict("Un producto del pedido ya no está disponible.");
            int stock = number(field(product, "stock", "Existencias"), 0);
            if (entry.getValue() > stock) throw conflict("Stock insuficiente para " + field(product, "name", "Producto") + ". Disponible: " + stock + ".");
            BigDecimal unitPrice = promotions.priceForProduct(entry.getKey(), decimal(field(product, "price", "Valor")));
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(entry.getValue()));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("productId", entry.getKey().toString()); item.put("productName", field(product, "name", "Producto"));
            item.put("sku", field(product, "sku", "SKU")); item.put("quantity", entry.getValue());
            item.put("unitPrice", unitPrice); item.put("subtotal", lineTotal); orderItems.add(item); subtotal = subtotal.add(lineTotal);
        }
        String discountCode = text(input.get("discountCode")).toUpperCase(Locale.ROOT);
        BigDecimal discount = promotions.useCode(discountCode, subtotal);
        BigDecimal total = subtotal.subtract(discount);
        UUID orderId = UUID.randomUUID();
        Instant now = Instant.now();
        String status = paymentMethod.equals("card") ? "En preparación" : "Pendiente de pago";
        String paymentStatus = paymentMethod.equals("card") ? "Simulada" : "Pendiente de verificación";
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("customer", customerName); data.put("customerEmail", customerEmail); data.put("customerPhone", optionalText(input.get("customerPhone")));
        data.put("address", address); data.put("date", now.toString()); data.put("status", status);
        data.put("paymentMethod", paymentMethod); data.put("payment", paymentMethod.equals("card") ? "Tarjeta" : "Transferencia");
        data.put("paymentStatus", paymentStatus); data.put("items", orderItems); data.put("subtotal", subtotal);
        data.put("discountAmount", discount); data.put("discountCode", discountCode); data.put("total", total);
        data.put("orderNumber", "NX-" + orderId.toString().substring(0, 8).toUpperCase(Locale.ROOT));
        ensureCustomer(customerName, customerEmail, optionalText(input.get("customerPhone")));
        jdbc.update("INSERT INTO business_records (id, resource_code, data, status_code) VALUES (?, 'orders', ?::jsonb, ?)", orderId, writeJson(data), status);
        syncProjection(orderId, "orders", data, null);
        if (paymentMethod.equals("transfer")) saveTransferReceipt(orderId, input);
        for (var entry : quantities.entrySet()) changeStock(entry.getKey(), -entry.getValue(), "ORDER", "Reserva del pedido " + data.get("orderNumber"), orderId, null);
        return new BusinessRecordResponse(orderId, "orders", data, now, now);
    }

    private void saveTransferReceipt(UUID orderId, Map<String, Object> input) {
        String image = text(input.get("receiptImage"));
        if (!image.matches("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$") || image.length() > 1_400_000)
            throw invalid("Adjunta un comprobante JPG, PNG o WEBP de hasta 1 MB.");
        byte[] bytes;
        try { bytes = java.util.Base64.getDecoder().decode(image.substring(image.indexOf(',') + 1)); }
        catch (IllegalArgumentException exception) { throw invalid("El comprobante no contiene una imagen válida."); }
        if (bytes.length < 16 || bytes.length > 1_048_576) throw invalid("El comprobante debe medir entre 16 bytes y 1 MB.");
        boolean png = image.startsWith("data:image/png;") && bytes[0] == (byte) 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G';
        boolean jpeg = image.startsWith("data:image/jpeg;") && bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xd8;
        boolean webp = image.startsWith("data:image/webp;") && new String(bytes, 0, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF")
                && new String(bytes, 8, 4, java.nio.charset.StandardCharsets.US_ASCII).equals("WEBP");
        if (!png && !jpeg && !webp) throw invalid("El comprobante no coincide con el formato de imagen indicado.");
        String fileName = text(input.get("receiptFileName"));
        String reference = text(input.get("receiptReference"));
        if (fileName.length() > 255 || reference.length() > 160) throw invalid("El nombre o referencia del comprobante es demasiado largo.");
        jdbc.update("INSERT INTO transfer_receipts (order_record_id, image_data_url, file_name, reference) VALUES (?, ?, ?, ?)",
                orderId, image, fileName, reference);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> transferReceipts() {
        authorize("orders", "view");
        return jdbc.query("""
                SELECT r.order_record_id, r.image_data_url, r.file_name, r.reference, r.status, r.submitted_at,
                       o.customer_name, o.customer_phone, o.delivery_address, o.total
                FROM transfer_receipts r JOIN commerce_orders o ON o.record_id = r.order_record_id
                ORDER BY r.submitted_at DESC
                """, (rs, row) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rs.getObject("order_record_id", UUID.class).toString());
            item.put("orderId", rs.getObject("order_record_id", UUID.class).toString());
            item.put("customer", rs.getString("customer_name"));
            item.put("phone", rs.getString("customer_phone"));
            item.put("address", rs.getString("delivery_address"));
            item.put("total", rs.getBigDecimal("total"));
            item.put("image", rs.getString("image_data_url"));
            item.put("fileName", rs.getString("file_name"));
            item.put("reference", rs.getString("reference"));
            item.put("status", rs.getString("status"));
            item.put("date", rs.getTimestamp("submitted_at").toInstant().toString());
            return item;
        });
    }

    @Transactional
    public Map<String, Object> reviewTransferReceipt(UUID id, String status) {
        authorize("orders", "approve");
        if (!Set.of("Aprobada", "Rechazada").contains(status)) throw invalid("El estado del comprobante no es válido.");
        String current = jdbc.query("SELECT status FROM transfer_receipts WHERE order_record_id = ? FOR UPDATE",
                rs -> rs.next() ? rs.getString(1) : null, id);
        if (current == null) throw missing();
        if (!"Pendiente".equals(current)) throw conflict("El comprobante ya fue revisado.");
        Map<String, Object> before = lockedRecord("orders", id);
        Map<String, Object> data = new LinkedHashMap<>(before);
        data.put("paymentStatus", status);
        data.put("status", status.equals("Aprobada") ? "En preparación" : "Cancelado");
        transitionOrder(id, before, data, actorId());
        jdbc.update("UPDATE business_records SET data = ?::jsonb, status_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                writeJson(data), statusOf(data), id);
        syncOrder(id, data);
        jdbc.update("UPDATE transfer_receipts SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE order_record_id = ?",
                status, actorId(), id);
        return Map.of("id", id, "status", status);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> publicPaymentSettings() {
        return jdbc.query("SELECT setting_value::text FROM business_settings WHERE setting_key = 'payment-methods'", rs -> {
            if (!rs.next()) return Map.of("card", true, "transfer", true);
            return readMap(rs.getString(1));
        });
    }

    @Transactional(readOnly = true)
    public Map<String, Object> businessProfileSettings() {
        authorize("settings", "view");
        return jdbc.query("SELECT setting_value::text FROM business_settings WHERE setting_key = 'business-profile'", rs -> {
            if (!rs.next()) return defaultBusinessProfile();
            return readMap(rs.getString(1));
        });
    }

    @Transactional
    public Map<String, Object> updateBusinessProfileSettings(Map<String, Object> input) {
        authorize("settings", "edit");
        Map<String, Object> data = clean(input);
        String name = text(data.get("businessName"));
        String email = text(data.get("contactEmail")).toLowerCase(Locale.ROOT);
        String phone = text(data.get("phone"));
        String address = text(data.get("address"));
        if (name.isBlank() || name.length() > 160) throw invalid("El nombre comercial debe tener entre 1 y 160 caracteres.");
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw invalid("Ingresa un correo de contacto válido.");
        if (phone.length() > 40 || address.length() > 500) throw invalid("El teléfono o la dirección superan el tamaño permitido.");
        Object rawNotifications = data.get("notifications");
        if (!(rawNotifications instanceof Map<?, ?> notifications)
                || !(notifications.get("orders") instanceof Boolean) || !(notifications.get("stock") instanceof Boolean)) {
            throw invalid("Configura las alertas de pedidos y existencias.");
        }
        Map<String, Object> safe = new LinkedHashMap<>();
        safe.put("businessName", name); safe.put("contactEmail", email); safe.put("phone", phone); safe.put("address", address);
        safe.put("notifications", Map.of("orders", notifications.get("orders"), "stock", notifications.get("stock")));
        jdbc.update("""
                INSERT INTO business_settings (setting_key, setting_value, updated_by)
                VALUES ('business-profile', ?::jsonb, ?)
                ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value,
                updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
                """, writeJson(safe), actorId());
        return safe;
    }

    private Map<String, Object> defaultBusinessProfile() {
        return Map.of("businessName", "NEXO Commerce", "contactEmail", "contacto@nexo.gt", "phone", "", "address", "",
                "notifications", Map.of("orders", true, "stock", true));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> inventoryMovements() {
        authorize("inventory", "view");
        return jdbc.query("""
                SELECT m.id, m.product_record_id, m.movement_type, m.quantity_delta, m.stock_before,
                       m.stock_after, m.reason, m.related_record_id, m.created_at, p.data::text product_data
                FROM inventory_movements m JOIN business_records p ON p.id = m.product_record_id
                ORDER BY m.created_at DESC LIMIT 500
                """, (rs, row) -> {
            Map<String, Object> product = readMap(rs.getString("product_data"));
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", rs.getObject("id", UUID.class).toString());
            result.put("productId", rs.getObject("product_record_id", UUID.class).toString());
            result.put("productName", field(product, "name", "Producto"));
            result.put("sku", field(product, "sku", "SKU"));
            result.put("type", rs.getString("movement_type"));
            result.put("quantity", rs.getInt("quantity_delta"));
            result.put("stockBefore", rs.getInt("stock_before"));
            result.put("stockAfter", rs.getInt("stock_after"));
            result.put("reason", rs.getString("reason"));
            result.put("relatedRecordId", rs.getString("related_record_id"));
            result.put("createdAt", rs.getTimestamp("created_at").toInstant().toString());
            return result;
        });
    }

    @Transactional(readOnly = true)
    public Map<String, Object> inventorySummary() {
        authorize("inventory", "view");
        return inventorySummaryWithoutAuthorization();
    }

    private Map<String, Object> inventorySummaryWithoutAuthorization() {
        List<Map<String, Object>> products = listWithoutAuthorization("products");
        List<Map<String, Object>> active = products.stream().filter(p -> !isInactive(p)).toList();
        int count = active.size();
        int totalUnits = active.stream().mapToInt(p -> number(field(p, "stock", "Existencias"), 0)).sum();
        long low = active.stream().filter(p -> number(field(p, "stock", "Existencias"), 0) > 0 && number(field(p, "stock", "Existencias"), 0) < 10).count();
        long empty = active.stream().filter(p -> number(field(p, "stock", "Existencias"), 0) == 0).count();
        return Map.of("products", count, "totalUnits", totalUnits, "lowStock", low, "outOfStock", empty);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dashboardSummary(String period) {
        authorize("dashboard", "view");
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate start = switch (period == null ? "30d" : period) {
            case "7d" -> today.minusDays(6);
            case "year" -> today.withDayOfYear(1);
            case "30d" -> today.minusDays(29);
            default -> throw invalid("El periodo del tablero no es válido.");
        };
        java.sql.Timestamp startAt = java.sql.Timestamp.from(start.atStartOfDay().toInstant(ZoneOffset.UTC));
        java.sql.Timestamp endAt = java.sql.Timestamp.from(today.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
        Map<String, Object> totals = jdbc.query("""
                SELECT COALESCE(SUM(amount), 0) AS total_sales, COALESCE(SUM(transaction_count), 0) AS transactions
                FROM (
                    SELECT s.total AS amount, 1 AS transaction_count FROM in_person_sales s
                    WHERE s.sale_date >= ? AND s.sale_date < ? AND s.status <> 'Cancelado'
                    UNION ALL
                    SELECT o.total AS amount, 1 AS transaction_count FROM commerce_orders o
                    WHERE o.order_date >= ? AND o.order_date < ? AND o.status <> 'Cancelado'
                ) activity
                """, rs -> { rs.next(); return Map.of("sales", rs.getBigDecimal("total_sales"), "orders", rs.getLong("transactions")); }, startAt, endAt, startAt, endAt);
        List<Map<String, Object>> series = jdbc.query("""
                SELECT DATE(bucket) AS day, COALESCE(SUM(amount), 0) AS sales, COALESCE(SUM(transaction_count), 0) AS orders
                FROM (
                    SELECT s.sale_date AS bucket, s.total AS amount, 1 AS transaction_count FROM in_person_sales s
                    WHERE s.sale_date >= ? AND s.sale_date < ? AND s.status <> 'Cancelado'
                    UNION ALL
                    SELECT o.order_date AS bucket, o.total AS amount, 1 AS transaction_count FROM commerce_orders o
                    WHERE o.order_date >= ? AND o.order_date < ? AND o.status <> 'Cancelado'
                ) activity GROUP BY DATE(bucket) ORDER BY DATE(bucket)
                """, (rs, row) -> Map.<String, Object>of("date", rs.getDate("day").toLocalDate().toString(),
                "sales", rs.getBigDecimal("sales"), "orders", rs.getLong("orders")), startAt, endAt, startAt, endAt);
        Long newCustomers = jdbc.queryForObject("SELECT COUNT(*) FROM customers WHERE created_at >= ? AND created_at < ?", Long.class, startAt, endAt);
        BigDecimal totalSales = (BigDecimal) totals.get("sales");
        long count = ((Number) totals.get("orders")).longValue();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sales", totalSales);
        result.put("orders", count);
        result.put("newCustomers", newCustomers == null ? 0 : newCustomers);
        result.put("averageTicket", count == 0 ? BigDecimal.ZERO : totalSales.divide(BigDecimal.valueOf(count), 2, java.math.RoundingMode.HALF_UP));
        result.put("products", inventorySummaryWithoutAuthorization());
        result.put("series", series);
        result.put("recentActivity", recentActivity());
        return result;
    }

    private List<Map<String, Object>> recentActivity() {
        return jdbc.query("""
                SELECT resource_code, data::text, created_at FROM business_records
                WHERE resource_code IN ('orders', 'sales') ORDER BY created_at DESC LIMIT 8
                """, (rs, row) -> {
            String resource = rs.getString("resource_code");
            Map<String, Object> data = readMap(rs.getString("data"));
            Instant createdAt = rs.getTimestamp("created_at").toInstant();
            long minutes = Math.max(0, Duration.between(createdAt, Instant.now()).toMinutes());
            String elapsed = minutes < 60 ? "Hace " + minutes + " min" : minutes < 1440 ? "Hace " + (minutes / 60) + " h" : "Hace " + (minutes / 1440) + " días";
            return Map.<String, Object>of("id", rs.getTimestamp("created_at").toInstant().toString(),
                    "title", resource.equals("sales") ? "Venta presencial" : "Pedido en línea",
                    "description", resource.equals("sales") ? "Venta por " + text(data.get("seller")) : text(data.get("customer")) + " · " + text(data.get("orderNumber")),
                    "time", elapsed, "type", resource);
        });
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> publicProducts() {
        return jdbc.query("SELECT id, data::text FROM business_records WHERE resource_code = 'products' ORDER BY created_at DESC", (rs, row) -> {
            Map<String, Object> data = readMap(rs.getString("data"));
            if (isInactive(data)) return null;
            data.put("id", rs.getObject("id", UUID.class).toString());
            return data;
        }).stream().filter(java.util.Objects::nonNull).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> publicProduct(UUID id) {
        return jdbc.query("SELECT data::text FROM business_records WHERE id = ? AND resource_code = 'products'", rs -> {
            if (!rs.next()) throw missing();
            Map<String, Object> product = readMap(rs.getString(1));
            if (isInactive(product)) throw missing();
            product.put("id", id.toString());
            return product;
        }, id);
    }

    @Transactional
    public Map<String, Object> paymentSettings() {
        authorize("settings", "view");
        return jdbc.query("SELECT setting_value::text FROM business_settings WHERE setting_key = 'payment-methods'", rs -> {
            if (!rs.next()) return Map.of("card", true, "transfer", true);
            return readMap(rs.getString(1));
        });
    }

    @Transactional
    public Map<String, Object> updatePaymentSetting(String method, boolean enabled) {
        authorize("settings", "edit");
        if (!Set.of("card", "transfer").contains(method)) throw invalid("El método de pago no es válido.");
        Map<String, Object> current = jdbc.query("SELECT setting_value::text FROM business_settings WHERE setting_key = 'payment-methods'", rs -> {
            if (!rs.next()) return new LinkedHashMap<>(Map.of("card", true, "transfer", true));
            return new LinkedHashMap<>(readMap(rs.getString(1)));
        });
        current.put(method, enabled);
        if (!Boolean.TRUE.equals(current.get("card")) && !Boolean.TRUE.equals(current.get("transfer"))) throw conflict("Debe quedar al menos un método de pago activo.");
        jdbc.update("""
                INSERT INTO business_settings (setting_key, setting_value, updated_by) VALUES ('payment-methods', ?::jsonb, ?)
                ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
                """, writeJson(current), actorId());
        return current;
    }

    private void applyPurchase(UUID purchaseId, Map<String, Object> data, UUID actor) {
        if (!"Registrada".equals(field(data, "status", "Estado"))) return;
        for (Map<String, Object> item : items(data)) {
            int quantity = number(item.get("quantity"), 0);
            if (quantity < 1) throw invalid("Las cantidades de compra deben ser enteros mayores que cero.");
            changeStock(parseUuid(item.get("productId")), quantity, "PURCHASE", "Compra " + purchaseId, purchaseId, actor);
        }
    }

    private void transitionPurchase(UUID id, Map<String, Object> before, Map<String, Object> after, UUID actor) {
        String previous = String.valueOf(field(before, "status", "Estado"));
        String next = String.valueOf(field(after, "status", "Estado"));
        if (previous.equals(next)) return;
        if ("Anulada".equals(previous)) throw conflict("Una compra anulada es inmutable.");
        if (!Set.of("Registrada", "Pendiente", "Anulada").contains(next)) throw invalid("El nuevo estado de compra no es válido.");
        if (previous.equals("Registrada") && next.equals("Pendiente")) throw conflict("Una compra recibida no puede volver a pendiente; anúlala si requiere reversión.");
        if (previous.equals("Registrada") && !samePurchaseContents(before, after)) throw conflict("Los productos y costos de una compra recibida no se pueden modificar; anúlala para registrar una corrección.");
        int multiplier = "Registrada".equals(previous) ? -1 : 0;
        if ("Registrada".equals(next)) multiplier += 1;
        if ("Anulada".equals(next) && "Registrada".equals(previous)) multiplier = -1;
        List<Map<String, Object>> stockItems = previous.equals("Pendiente") && next.equals("Registrada") ? items(after) : items(before);
        if (multiplier != 0) for (Map<String, Object> item : stockItems) {
            int quantity = number(item.get("quantity"), 0) * multiplier;
            changeStock(parseUuid(item.get("productId")), quantity, "REVERSAL", "Cambio de estado de compra " + id, id, actor);
        }
    }

    private void transitionOrder(UUID id, Map<String, Object> before, Map<String, Object> after, UUID actor) {
        String previous = String.valueOf(field(before, "status", "Estado"));
        String next = String.valueOf(field(after, "status", "Estado"));
        if (previous.equals(next)) return;
        if ("Cancelado".equals(previous)) throw conflict("Un pedido cancelado no puede reabrirse.");
        if ("Completado".equals(previous)) throw conflict("Un pedido completado no se puede cancelar desde el panel; registra una devolución para ajustar existencias.");
        if (!Set.of("Pendiente de pago", "En preparación", "Completado", "Cancelado").contains(next)) throw invalid("El estado del pedido no es válido.");
        if (next.equals("En preparación") && previous.equals("Pendiente de pago")
                && !Set.of("Aprobada", "Simulada", "approved").contains(String.valueOf(field(after, "paymentStatus", "Estado de pago")))) {
            throw conflict("El pago debe aprobarse o simularse antes de preparar el pedido.");
        }
        if (next.equals("Completado") && !previous.equals("En preparación")) throw conflict("El pedido debe estar en preparación antes de completarse.");
        if (!next.equals("Cancelado") && !((previous.equals("Pendiente de pago") && next.equals("En preparación"))
                || (previous.equals("En preparación") && next.equals("Completado")))) {
            throw conflict("La transición solicitada no está permitida para este pedido.");
        }
        if ("Cancelado".equals(next) && !previous.equals(next)) {
            for (Map<String, Object> item : items(before)) {
                changeStock(parseUuid(item.get("productId")), number(item.get("quantity"), 0), "REVERSAL",
                        "Liberación del pedido cancelado " + id, id, actor);
            }
        }
    }

    private void transitionSale(UUID id, Map<String, Object> before, Map<String, Object> after, UUID actor) {
        String previous = String.valueOf(field(before, "status", "Estado"));
        String next = String.valueOf(field(after, "status", "Estado"));
        if (previous.equals(next)) return;
        if (!previous.equals("Completado") || !next.equals("Cancelado")) throw conflict("Solo se puede anular una venta completada.");
        for (Map<String, Object> item : items(before)) changeStock(parseUuid(item.get("productId")), number(item.get("quantity"), 0),
                "REVERSAL", "Anulación de venta " + id, id, actor);
    }

    private void transitionAccounting(Map<String, Object> before, Map<String, Object> after) {
        for (String key : List.of("date", "concept", "category", "type", "amount")) {
            if (!java.util.Objects.equals(before.get(key), after.get(key))) {
                throw conflict("Los datos de un movimiento contable no se editan después de registrarlo; anúlalo y crea uno nuevo.");
            }
        }
        String previous = String.valueOf(field(before, "status", "Estado"));
        String next = String.valueOf(field(after, "status", "Estado"));
        if (previous.equals(next)) return;
        if ("Anulado".equals(previous)) throw conflict("Un movimiento anulado no se puede reabrir.");
        if (!Set.of("Registrado", "Pendiente").contains(previous) || !"Anulado".equals(next)) {
            throw invalid("Un movimiento solo puede pasar a estado Anulado.");
        }
    }

    private boolean sameOrderContents(Map<String, Object> before, Map<String, Object> after) {
        for (String key : List.of("customer", "customerEmail", "customerPhone", "address", "date", "paymentMethod", "payment", "subtotal", "discountAmount", "discountCode", "total", "items")) {
            if (!java.util.Objects.equals(before.get(key), after.get(key))) return false;
        }
        return true;
    }

    private boolean samePurchaseContents(Map<String, Object> before, Map<String, Object> after) {
        if (!java.util.Objects.equals(before.get("supplierId"), after.get("supplierId"))
                || !java.util.Objects.equals(before.get("date"), after.get("date"))) return false;
        List<Map<String, Object>> beforeItems = normalizedPurchaseItems(before);
        List<Map<String, Object>> afterItems = normalizedPurchaseItems(after);
        return beforeItems.equals(afterItems);
    }

    private void changeStock(UUID productId, int delta, String type, String reason, UUID relatedId, UUID actor) {
        Map<String, Object> product = lockedRecord("products", productId);
        int before = number(field(product, "stock", "Existencias"), 0);
        int after = before + delta;
        if (after < 0) throw conflict("La operación dejaría existencias negativas para " + field(product, "name", "Producto") + ".");
        String key = product.containsKey("stock") ? "stock" : "Existencias";
        product.put(key, after);
        if (product.containsKey("status")) product.put("status", Set.of("Inactivo", "Inactive", "DISABLED").contains(String.valueOf(product.get("status"))) ? "Inactivo" : productStatus(after));
        else if (product.containsKey("Estado")) product.put("Estado", Set.of("Inactivo", "Inactive", "DISABLED").contains(String.valueOf(product.get("Estado"))) ? "Inactivo" : localizedProductStatus(after));
        jdbc.update("UPDATE business_records SET data = ?::jsonb, status_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                writeJson(product), statusOf(product), productId);
        syncProjection(productId, "products", product, actor);
        inventoryMovement(productId, after < before ? type : type.equals("REVERSAL") ? type : type,
                delta, before, after, reason, relatedId, actor);
    }

    private void syncProjection(UUID id, String resource, Map<String, Object> data, UUID actor) {
        switch (resource) {
            case "brands" -> jdbc.update("""
                    INSERT INTO brands (record_id, name, description, contact, website, status)
                    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (record_id) DO UPDATE SET name = EXCLUDED.name,
                    description = EXCLUDED.description, contact = EXCLUDED.contact, website = EXCLUDED.website, status = EXCLUDED.status
                    """, id, text(field(data, "name", "Nombre")), optionalText(data.get("description")),
                    optionalText(data.get("contact")), optionalText(data.get("website")), defaultText(data.get("status"), "Activa"));
            case "categories" -> {
                String name = text(field(data, "name", "Nombre"));
                jdbc.update("""
                        INSERT INTO product_categories (record_id, name, status) VALUES (?, ?, ?)
                        ON CONFLICT (record_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status
                        """, id, name, defaultText(field(data, "status", "Estado"), "Activo"));
                jdbc.update("UPDATE products SET category_record_id = ? WHERE LOWER(category_name) = LOWER(?)", id, name);
            }
            case "products" -> {
                String category = text(field(data, "category", "Categoría"));
                jdbc.update("""
                        INSERT INTO products (record_id, brand_record_id, category_record_id, sku, name, category_name,
                        price, compare_at, stock, status, image_url, description, featured)
                        VALUES (?, ?, (SELECT record_id FROM product_categories WHERE LOWER(name) = LOWER(?)), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (record_id) DO UPDATE SET brand_record_id = EXCLUDED.brand_record_id,
                        category_record_id = EXCLUDED.category_record_id, sku = EXCLUDED.sku, name = EXCLUDED.name,
                        category_name = EXCLUDED.category_name, price = EXCLUDED.price, compare_at = EXCLUDED.compare_at,
                        stock = EXCLUDED.stock, status = EXCLUDED.status, image_url = EXCLUDED.image_url,
                        description = EXCLUDED.description, featured = EXCLUDED.featured, updated_at = CURRENT_TIMESTAMP
                        """, id, parseOptionalUuid(field(data, "brandId", "Marca")), category,
                        text(field(data, "sku", "SKU")), text(field(data, "name", "Producto")), category,
                        decimal(field(data, "price", "Valor")), optionalDecimal(field(data, "compareAt", "Precio anterior")),
                        number(field(data, "stock", "Existencias"), 0), defaultText(field(data, "status", "Estado"), "Activo"),
                        optionalText(field(data, "image", "Imagen")), defaultText(field(data, "description", "Descripción"), ""),
                        Boolean.TRUE.equals(data.get("featured")));
            }
            case "suppliers" -> {
                jdbc.update("""
                        INSERT INTO suppliers (record_id, name, contact_person, phone, email, status)
                        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (record_id) DO UPDATE SET name = EXCLUDED.name,
                        contact_person = EXCLUDED.contact_person, phone = EXCLUDED.phone, email = EXCLUDED.email, status = EXCLUDED.status
                        """, id, text(field(data, "name", "Empresa")), optionalText(field(data, "contactPerson", "Contacto")),
                        optionalText(field(data, "phone", "Teléfono")), optionalText(field(data, "email", "Correo")),
                        defaultText(field(data, "status", "Estado"), "Activo"));
                jdbc.update("DELETE FROM supplier_products WHERE supplier_record_id = ?", id);
                Object rawProducts = data.get("productIds");
                if (rawProducts instanceof List<?> productIds) for (Object raw : productIds) {
                    UUID productId = parseUuid(raw);
                    Boolean exists = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM products WHERE record_id = ?)", Boolean.class, productId);
                    if (!Boolean.TRUE.equals(exists)) throw invalid("Un producto asociado al proveedor ya no existe.");
                    jdbc.update("INSERT INTO supplier_products (supplier_record_id, product_record_id) VALUES (?, ?)", id, productId);
                }
            }
            case "customers" -> {
                String name = text(field(data, "name", "Nombre"));
                String email = text(field(data, "email", "Correo")).toLowerCase(Locale.ROOT);
                String status = defaultText(field(data, "status", "Estado"), "Activo");
                jdbc.update("""
                        INSERT INTO customers (record_id, name, email, phone, status) VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT (record_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
                        phone = EXCLUDED.phone, status = EXCLUDED.status
                        """, id, name, email, optionalText(data.get("phone")), status);
            jdbc.update("""
                UPDATE app_user SET display_name = ?, email = ?, status = CASE WHEN ? = 'Inactivo' THEN 'DISABLED' WHEN ? = 'Pendiente' THEN 'PENDING' WHEN ? = 'Activo' THEN 'ACTIVE' ELSE status END,
                        updated_at = CURRENT_TIMESTAMP WHERE id = ?
                """, name, email, status, status, status, id);
            }
            case "purchases" -> syncPurchase(id, data);
            case "sales" -> syncSale(id, data, actor);
            case "orders" -> syncOrder(id, data);
            case "accounting" -> jdbc.update("""
                    INSERT INTO accounting_movements (record_id, movement_date, concept, category, entry_type, amount, status, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (record_id) DO UPDATE SET movement_date = EXCLUDED.movement_date,
                    concept = EXCLUDED.concept, category = EXCLUDED.category, entry_type = EXCLUDED.entry_type,
                    amount = EXCLUDED.amount, status = EXCLUDED.status
                    """, id, date(field(data, "date", "Fecha")), text(field(data, "concept", "Concepto")),
                    text(field(data, "category", "Categoría")), defaultText(field(data, "type", "Tipo"), "Ingreso"),
                    decimal(field(data, "amount", "Monto")), defaultText(field(data, "status", "Estado"), "Registrado"), actor);
            default -> { }
        }
    }

    private void syncPurchase(UUID id, Map<String, Object> data) {
        UUID supplierId = parseUuid(data.get("supplierId"));
        List<Map<String, Object>> purchaseItems = normalizedPurchaseItems(data);
        data.put("items", purchaseItems);
        Boolean activeSupplier = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM suppliers WHERE record_id = ? AND status = 'Activo')", Boolean.class, supplierId);
        if (!Boolean.TRUE.equals(activeSupplier)) throw conflict("El proveedor no está activo para recibir compras.");
        BigDecimal total = BigDecimal.ZERO;
        for (Map<String, Object> item : purchaseItems) total = total.add(decimal(item.get("unitCost")).multiply(BigDecimal.valueOf(number(item.get("quantity"), 0))));
        data.put("total", total);
        jdbc.update("""
                INSERT INTO merchandise_purchases (record_id, supplier_record_id, purchase_date, status, total)
                VALUES (?, ?, ?, ?, ?) ON CONFLICT (record_id) DO UPDATE SET supplier_record_id = EXCLUDED.supplier_record_id,
                purchase_date = EXCLUDED.purchase_date, status = EXCLUDED.status, total = EXCLUDED.total
                """, id, supplierId, date(field(data, "date", "Fecha")), defaultText(field(data, "status", "Estado"), "Registrada"), total);
        jdbc.update("DELETE FROM merchandise_purchase_items WHERE purchase_record_id = ?", id);
        for (Map<String, Object> item : purchaseItems) {
            UUID productId = parseUuid(item.get("productId"));
            int quantity = number(item.get("quantity"), 0);
            BigDecimal cost = decimal(item.get("unitCost"));
            String name = text(item.get("productName"));
            Boolean supplied = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM supplier_products WHERE supplier_record_id = ? AND product_record_id = ?)", Boolean.class, supplierId, productId);
            if (!Boolean.TRUE.equals(supplied)) throw conflict("La compra contiene un producto no asociado con el proveedor seleccionado.");
            jdbc.update("""
                    INSERT INTO merchandise_purchase_items (purchase_record_id, product_record_id, product_name_snapshot, quantity, unit_cost, line_total)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, id, productId, name, quantity, cost, cost.multiply(BigDecimal.valueOf(quantity)));
        }
    }

    private List<Map<String, Object>> normalizedPurchaseItems(Map<String, Object> data) {
        Map<UUID, Map<String, Object>> grouped = new LinkedHashMap<>();
        Map<UUID, BigDecimal> lineTotals = new LinkedHashMap<>();
        for (Map<String, Object> item : items(data)) {
            UUID productId = parseUuid(item.get("productId"));
            int quantity = number(item.get("quantity"), 0);
            BigDecimal unitCost = decimal(item.get("unitCost"));
            if (quantity < 1 || unitCost.signum() <= 0) throw invalid("Cada producto de la compra necesita cantidad y costo unitario mayores que cero.");
            Map<String, Object> combined = grouped.computeIfAbsent(productId, ignored -> {
                Map<String, Object> row = new LinkedHashMap<>(); row.put("productId", productId.toString()); row.put("productName", item.get("productName")); row.put("quantity", 0); return row;
            });
            combined.put("quantity", number(combined.get("quantity"), 0) + quantity);
            lineTotals.merge(productId, unitCost.multiply(BigDecimal.valueOf(quantity)), BigDecimal::add);
        }
        grouped.forEach((productId, row) -> {
            int quantity = number(row.get("quantity"), 0);
            row.put("unitCost", lineTotals.get(productId).divide(BigDecimal.valueOf(quantity), 2, java.math.RoundingMode.HALF_UP));
        });
        return new ArrayList<>(grouped.values());
    }

    private void syncSale(UUID id, Map<String, Object> data, UUID actor) {
        String seller = text(data.get("seller"));
        String method = defaultText(data.get("paymentMethod"), "card");
        String paymentStatus = defaultText(data.get("paymentStatus"), "Simulada");
        BigDecimal total = decimal(data.get("total"));
        jdbc.update("""
                INSERT INTO in_person_sales (record_id, seller_user_id, seller_name, sale_date, payment_method, payment_status, total, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (record_id) DO UPDATE SET seller_name = EXCLUDED.seller_name,
                payment_status = EXCLUDED.payment_status, total = EXCLUDED.total, status = EXCLUDED.status
        """, id, actor, seller, parseInstant(data.get("date")), method, paymentStatus, total,
                defaultText(field(data, "status", "Estado"), "Completado"));
        jdbc.update("DELETE FROM in_person_sale_items WHERE sale_record_id = ?", id);
        for (Map<String, Object> item : items(data)) jdbc.update("""
                INSERT INTO in_person_sale_items (sale_record_id, product_record_id, product_name_snapshot, sku_snapshot, quantity, unit_price, line_total)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, parseUuid(item.get("productId")), text(item.get("productName")), text(item.get("sku")),
                number(item.get("quantity"), 0), decimal(item.get("unitPrice")), decimal(item.get("subtotal")));
    }

    private void syncOrder(UUID id, Map<String, Object> data) {
        String status = defaultText(field(data, "status", "Estado"), "Pendiente de pago");
        String payment = "Transferencia".equals(field(data, "payment", "Método de pago")) ? "transfer" : defaultText(data.get("paymentMethod"), "card");
        String paymentStatus = defaultText(data.get("paymentStatus"), status.equals("Completado") ? "approved" : "pending_verification");
        BigDecimal total = decimal(field(data, "total", "Total"));
        jdbc.update("""
                INSERT INTO commerce_orders (record_id, customer_name, customer_email, order_date, status, payment_method, payment_status, total, customer_phone, delivery_address, subtotal, discount_amount, discount_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (record_id) DO UPDATE SET customer_name = EXCLUDED.customer_name,
                customer_email = EXCLUDED.customer_email, status = EXCLUDED.status, payment_method = EXCLUDED.payment_method,
                payment_status = EXCLUDED.payment_status, total = EXCLUDED.total, customer_phone = EXCLUDED.customer_phone,
                delivery_address = EXCLUDED.delivery_address
                """, id, defaultText(field(data, "customer", "Cliente"), "Cliente"), optionalText(data.get("customerEmail")),
                parseInstant(field(data, "date", "Fecha")), status, payment, paymentStatus, total,
                optionalText(data.get("customerPhone")), optionalText(data.get("address")),
                data.containsKey("subtotal") ? decimal(data.get("subtotal")) : total,
                data.containsKey("discountAmount") ? decimal(data.get("discountAmount")) : BigDecimal.ZERO,
                optionalText(data.get("discountCode")));
        jdbc.update("DELETE FROM commerce_order_items WHERE order_record_id = ?", id);
        for (Map<String, Object> item : items(data)) jdbc.update("""
                INSERT INTO commerce_order_items (order_record_id, product_record_id, product_name_snapshot, sku_snapshot, quantity, unit_price, line_total)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, parseUuid(item.get("productId")), text(item.get("productName")), defaultText(item.get("sku"), ""),
                number(item.get("quantity"), 0), decimal(item.get("unitPrice")), decimal(item.getOrDefault("subtotal", item.get("lineTotal"))));
        jdbc.update("""
                INSERT INTO payment_transactions (record_id, order_record_id, payment_method, status, reference)
                VALUES (?, ?, ?, ?, ?) ON CONFLICT (record_id) DO UPDATE SET status = EXCLUDED.status, reference = EXCLUDED.reference
                """, id, id, payment, paymentStatus, optionalText(data.get("paymentReference")));
    }

    private void ensureCustomer(String name, String email, String phone) {
        UUID existingId = jdbc.query("""
                SELECT id FROM business_records WHERE resource_code = 'customers' AND LOWER(COALESCE(data ->> 'email', '')) = LOWER(?) FOR UPDATE
                """, rs -> rs.next() ? rs.getObject(1, UUID.class) : null, email);
        if (existingId == null) {
            UUID id = UUID.randomUUID();
            Map<String, Object> data = new LinkedHashMap<>(); data.put("name", name); data.put("email", email);
            data.put("phone", phone); data.put("status", "Activo"); data.put("orders", 0); data.put("totalPurchased", BigDecimal.ZERO);
            jdbc.update("INSERT INTO business_records (id, resource_code, data, status_code) VALUES (?, 'customers', ?::jsonb, 'Activo')", id, writeJson(data));
            syncProjection(id, "customers", data, null);
        }
    }

    private void inventoryMovement(UUID productId, String type, int delta, int before, int after,
                                   String reason, UUID relatedId, UUID actor) {
        if (delta == 0) return;
        jdbc.update("""
                INSERT INTO inventory_movements (id, product_record_id, movement_type, quantity_delta,
                stock_before, stock_after, reason, related_record_id, actor_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), productId, type, delta, before, after, reason, relatedId, actor);
    }

    private boolean paymentEnabled(String method) {
        Map<String, Object> current = jdbc.query("SELECT setting_value::text FROM business_settings WHERE setting_key = 'payment-methods'", rs -> {
            if (!rs.next()) return Map.of("card", true, "transfer", true);
            return readMap(rs.getString(1));
        });
        return Boolean.TRUE.equals(current.get(method));
    }

    private List<Map<String, Object>> listWithoutAuthorization(String resource) {
        return jdbc.query("SELECT data::text FROM business_records WHERE resource_code = ? ORDER BY created_at DESC", (rs, row) -> readMap(rs.getString(1)), resource);
    }

    private UUID customerRecordId(Map<String, Object> data) {
        String email = text(field(data, "email", "Correo")).toLowerCase(Locale.ROOT);
        return jdbc.query("SELECT id, role_code FROM app_user WHERE LOWER(email) = LOWER(?)", rs -> {
            if (!rs.next()) return UUID.randomUUID();
            if (!"customer".equals(rs.getString("role_code"))) throw conflict("Ese correo está asociado a una cuenta de personal.");
            return rs.getObject("id", UUID.class);
        }, email);
    }

    private void ensureUnique(String resource, Map<String, Object> data, UUID currentId) {
        String column = switch (resource) {
            case "products" -> "LOWER(COALESCE(data ->> 'sku', data ->> 'SKU', ''))";
            case "brands", "categories" -> "LOWER(COALESCE(data ->> 'name', data ->> 'Nombre', ''))";
            case "suppliers" -> "LOWER(COALESCE(data ->> 'name', data ->> 'Empresa', ''))";
            case "customers" -> "LOWER(COALESCE(data ->> 'email', data ->> 'Correo', ''))";
            default -> null;
        };
        if (column == null) return;
        String key = switch (resource) {
            case "products" -> text(field(data, "sku", "SKU"));
            case "brands", "categories" -> text(field(data, "name", "Nombre"));
            case "suppliers" -> text(field(data, "name", "Empresa"));
            case "customers" -> text(field(data, "email", "Correo")).toLowerCase(Locale.ROOT);
            default -> "";
        };
        if (key.isBlank()) return;
        String sql = "SELECT EXISTS (SELECT 1 FROM business_records WHERE resource_code = ? AND " + column + " = LOWER(?)";
        if (currentId != null) sql += " AND id <> ?";
        sql += ")";
        Boolean duplicate = currentId == null
                ? jdbc.queryForObject(sql, Boolean.class, resource, key)
                : jdbc.queryForObject(sql, Boolean.class, resource, key, currentId);
        if (Boolean.TRUE.equals(duplicate)) throw conflict("Ya existe un registro con ese " + switch (resource) {
            case "products" -> "SKU";
            case "brands" -> "nombre de marca";
            case "categories" -> "nombre de categoría";
            case "suppliers" -> "nombre de proveedor";
            default -> "correo de cliente";
        } + ".");
    }

    private Map<String, Object> buildReport(Map<String, Object> input, UUID actor) {
        String name = defaultText(field(input, "name", "Reporte"), "Ventas");
        String period = defaultText(field(input, "period", "Periodo"), "Últimos 30 días");
        LocalDate end = LocalDate.now(ZoneOffset.UTC);
        LocalDate start = switch (period.toLowerCase(Locale.ROOT)) {
            case "últimos 7 días", "ultimos 7 dias", "7d" -> end.minusDays(6);
            case "este año", "este ano", "year" -> end.withDayOfYear(1);
            case "hoy", "today" -> end;
            default -> end.minusDays(29);
        };
        java.sql.Timestamp from = java.sql.Timestamp.from(start.atStartOfDay().toInstant(ZoneOffset.UTC));
        java.sql.Timestamp until = java.sql.Timestamp.from(end.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
        Map<String, Object> metrics = new LinkedHashMap<>();
        String lowerName = name.toLowerCase(Locale.ROOT);
        if (lowerName.contains("inventario") || lowerName.contains("stock")) {
            metrics.putAll(inventorySummaryWithoutAuthorization());
            metrics.put("estimatedRetailValue", jdbc.queryForObject("SELECT COALESCE(SUM(price * stock), 0) FROM products WHERE status NOT IN ('Inactivo', 'Inactive', 'DISABLED')", BigDecimal.class));
        } else if (lowerName.contains("cliente")) {
            metrics.put("customers", jdbc.queryForObject("SELECT COUNT(*) FROM customers WHERE created_at >= ? AND created_at < ?", Long.class, from, until));
            metrics.put("orders", jdbc.queryForObject("SELECT COUNT(*) FROM commerce_orders WHERE order_date >= ? AND order_date < ? AND status <> 'Cancelado'", Long.class, from, until));
        } else {
            metrics.put("inPersonSales", jdbc.queryForObject("SELECT COALESCE(SUM(total), 0) FROM in_person_sales WHERE sale_date >= ? AND sale_date < ? AND status <> 'Cancelado'", BigDecimal.class, from, until));
            metrics.put("onlineOrders", jdbc.queryForObject("SELECT COUNT(*) FROM commerce_orders WHERE order_date >= ? AND order_date < ? AND status <> 'Cancelado'", Long.class, from, until));
            metrics.put("onlineSales", jdbc.queryForObject("SELECT COALESCE(SUM(total), 0) FROM commerce_orders WHERE order_date >= ? AND order_date < ? AND status <> 'Cancelado'", BigDecimal.class, from, until));
        }
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("name", name); report.put("period", period); report.put("generatedBy", principalName());
        report.put("date", Instant.now().toString()); report.put("status", "Completado"); report.put("metrics", metrics);
        if (actor != null) report.put("generatedById", actor.toString());
        return report;
    }

    private Map<String, Object> lockedRecord(String resource, UUID id) {
        return jdbc.query("SELECT data::text FROM business_records WHERE id = ? AND resource_code = ? FOR UPDATE", rs -> {
            if (!rs.next()) throw missing();
            return readMap(rs.getString(1));
        }, id, resource);
    }

    private void validate(String resource, Map<String, Object> data) {
        if (data.isEmpty()) throw invalid("El registro no puede estar vacío.");
        if (resource.equals("products")) {
            required(data, "name", "Producto"); required(data, "sku", "SKU");
            BigDecimal price = decimal(field(data, "price", "Valor"));
            if (price.signum() < 0) throw invalid("El precio no puede ser negativo.");
            int stock = number(field(data, "stock", "Existencias"), 0);
            if (stock < 0) throw invalid("Las existencias no pueden ser negativas.");
            String requestedStatus = defaultText(field(data, "status", "Estado"), "Activo");
            if (!Set.of("Activo", "Inactivo", "Bajo stock", "Agotado").contains(requestedStatus)) throw invalid("El estado del producto no es válido.");
            data.put("status", requestedStatus.equals("Inactivo") ? "Inactivo" : productStatus(stock));
            if (field(data, "brandId", "Marca") != null && !String.valueOf(field(data, "brandId", "Marca")).isBlank()) {
                UUID brandId = parseOptionalUuid(field(data, "brandId", "Marca"));
                if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM brands WHERE record_id = ? AND status = 'Activa')", Boolean.class, brandId))) {
                    throw invalid("La marca seleccionada no existe o está inactiva.");
                }
            }
        }
        if (resource.equals("brands")) required(data, "name", "Nombre");
        if (resource.equals("categories")) required(data, "name", "Nombre");
        if (resource.equals("suppliers")) required(data, "name", "Empresa");
        if (resource.equals("customers")) {
            required(data, "name", "Nombre");
            String email = String.valueOf(field(data, "email", "Correo")).trim();
            if (email.isBlank() || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw invalid("Ingresa un correo válido para el cliente.");
            if (!Set.of("Activo", "Inactivo", "Pendiente").contains(defaultText(field(data, "status", "Estado"), "Activo"))) throw invalid("El estado del cliente no es válido.");
        }
        if (resource.equals("brands") && !Set.of("Activa", "Inactiva").contains(defaultText(field(data, "status", "Estado"), "Activa"))) throw invalid("El estado de la marca no es válido.");
        if (resource.equals("categories") && !Set.of("Activo", "Inactivo").contains(defaultText(field(data, "status", "Estado"), "Activo"))) throw invalid("El estado de la categoría no es válido.");
        if (resource.equals("suppliers") && !Set.of("Activo", "Inactivo").contains(defaultText(field(data, "status", "Estado"), "Activo"))) throw invalid("El estado del proveedor no es válido.");
        if (resource.equals("accounting")) {
            required(data, "date", "Fecha"); required(data, "concept", "Concepto"); required(data, "category", "Categoría");
            if (!Set.of("Ingreso", "Egreso").contains(defaultText(field(data, "type", "Tipo"), "Ingreso"))) throw invalid("El tipo de movimiento no es válido.");
            BigDecimal amount = decimal(field(data, "amount", "Monto"));
            if (amount.signum() <= 0) throw invalid("El monto debe ser mayor que cero.");
            if (!Set.of("Registrado", "Pendiente", "Anulado").contains(defaultText(field(data, "status", "Estado"), "Registrado"))) throw invalid("El estado del movimiento no es válido.");
            try { LocalDate.parse(text(field(data, "date", "Fecha"))); }
            catch (Exception exception) { throw invalid("La fecha del movimiento no es válida."); }
        }
        if (resource.equals("purchases")) {
            required(data, "supplier", "Proveedor");
            if (items(data).isEmpty()) throw invalid("La compra necesita al menos un producto.");
            parseUuid(data.get("supplierId"));
            for (Map<String, Object> item : items(data)) {
                if (number(item.get("quantity"), 0) < 1 || decimal(item.get("unitCost")).signum() <= 0) throw invalid("Cada producto de la compra necesita cantidad y costo unitario mayores que cero.");
                parseUuid(item.get("productId"));
            }
        }
    }

    private Map<String, Object> clean(Map<String, Object> input) {
        if (input == null) throw invalid("Debes enviar los datos del registro.");
        try {
            String json = mapper.writeValueAsString(input);
            if (json.length() > 262144) throw invalid("El registro supera el tamaño permitido.");
            @SuppressWarnings("unchecked") Map<String, Object> result = mapper.readValue(json, Map.class);
            return new LinkedHashMap<>(result);
        } catch (BusinessRuleException exception) { throw exception; }
        catch (Exception exception) { throw invalid("El formato del registro no es válido."); }
    }

    private String normalize(String resource) {
        String normalized = resource == null ? "" : resource.trim().toLowerCase(Locale.ROOT);
        if (!RESOURCES.contains(normalized)) throw new BusinessRuleException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "El módulo solicitado no existe.");
        return normalized;
    }

    private void authorize(String resource, String action) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String module = switch (resource) {
            case "brands", "categories", "products" -> "products";
            case "purchases" -> "inventory";
            case "accounting" -> "accounting";
            case "reports" -> "reports";
            case "payments", "transfers", "invoices", "orders" -> "orders";
            case "profile", "settings" -> "settings";
            case "roles-permissions" -> "users";
            default -> resource;
        };
        String requiredAction = action;
        if (resource.equals("orders") && action.equals("edit")) requiredAction = "approve";
        if (resource.equals("transfers") && action.equals("edit")) requiredAction = "approve";
        if (resource.equals("sales") && action.equals("edit")) requiredAction = "approve";
        if (!permissions.has(authentication, module, requiredAction)) throw new AccessDeniedException("Permiso requerido: " + module + ":" + requiredAction);
    }

    private UUID actorId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication() == null ? null : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return principal instanceof NexoUserPrincipal user ? user.getId() : null;
    }

    private String principalName() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) return "";
        return jdbc.query("SELECT display_name FROM app_user WHERE LOWER(email) = LOWER(?)", rs -> rs.next() ? rs.getString(1) : authentication.getName(), authentication.getName());
    }

    private List<Map<String, Object>> items(Map<String, Object> data) {
        Object raw = data.get("items");
        if (!(raw instanceof List<?> list)) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) if (item instanceof Map<?, ?> map) {
            Map<String, Object> row = new LinkedHashMap<>(); map.forEach((key, value) -> row.put(String.valueOf(key), value)); result.add(row);
        }
        return result;
    }

    private static Object field(Map<String, Object> data, String first, String second) {
        return data.containsKey(first) ? data.get(first) : data.get(second);
    }
    private static String statusOf(Map<String, Object> data) {
        Object status = field(data, "status", "Estado");
        if (status == null) status = data.get("Estado de pago");
        return status == null ? null : String.valueOf(status);
    }
    private static int number(Object value, int fallback) {
        if (value instanceof Number number) return number.intValue();
        try { return value == null ? fallback : new BigDecimal(String.valueOf(value)).intValueExact(); }
        catch (Exception ignored) { return fallback; }
    }
    private static BigDecimal decimal(Object value) {
        try { return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value)); }
        catch (Exception ignored) { throw invalid("El valor numérico no es válido."); }
    }
    private static UUID parseUuid(Object value) {
        try { return UUID.fromString(String.valueOf(value)); }
        catch (Exception ignored) { throw invalid("El identificador del producto no es válido."); }
    }
    private UUID parseOptionalUuid(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try { return UUID.fromString(String.valueOf(value)); }
        catch (Exception ignored) { throw invalid("La marca seleccionada no es válida."); }
    }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static boolean isInactive(Map<String, Object> data) { return Set.of("Inactivo", "Inactiva", "Inactive", "DISABLED").contains(String.valueOf(field(data, "status", "Estado"))); }
    private static String optionalText(Object value) { String text = text(value); return text.isBlank() ? null : text; }
    private static String defaultText(Object value, String fallback) { String text = text(value); return text.isBlank() ? fallback : text; }
    private static BigDecimal optionalDecimal(Object value) { return value == null || String.valueOf(value).isBlank() ? null : decimal(value); }
    private static LocalDate date(Object value) {
        try { return LocalDate.parse(text(value).substring(0, 10)); }
        catch (Exception ignored) { return LocalDate.now(); }
    }
    private static java.sql.Timestamp parseInstant(Object value) {
        try { return java.sql.Timestamp.from(Instant.parse(text(value))); }
        catch (Exception ignored) { return java.sql.Timestamp.from(Instant.now()); }
    }
    private Map<String, Object> readMap(String value) {
        try { @SuppressWarnings("unchecked") Map<String, Object> map = mapper.readValue(value, Map.class); return map; }
        catch (Exception exception) { throw new IllegalStateException("No se pudo leer un registro guardado.", exception); }
    }
    private String writeJson(Object data) {
        try { return mapper.writeValueAsString(data); }
        catch (Exception exception) { throw new IllegalArgumentException("No se pudo serializar el registro.", exception); }
    }
    private void required(Map<String, Object> data, String first, String second) {
        Object value = field(data, first, second);
        if (value == null || String.valueOf(value).isBlank()) throw invalid("Completa el campo " + second + ".");
    }
    private static String productStatus(int stock) { return stock == 0 ? "Agotado" : stock < 10 ? "Bajo stock" : "Activo"; }
    private static String localizedProductStatus(int stock) { return stock == 0 ? "Agotado" : stock < 10 ? "Bajo stock" : "En stock"; }
    private static BusinessRuleException invalid(String message) { return new BusinessRuleException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message); }
    private static BusinessRuleException conflict(String message) { return new BusinessRuleException(HttpStatus.CONFLICT, "BUSINESS_RULE_VIOLATION", message); }
    private static BusinessRuleException missing() { return new BusinessRuleException(HttpStatus.NOT_FOUND, "RECORD_NOT_FOUND", "El registro solicitado ya no está disponible."); }
}
