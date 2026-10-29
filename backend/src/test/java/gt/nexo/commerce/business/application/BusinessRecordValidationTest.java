package gt.nexo.commerce.business.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.application.PermissionAuthorizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.ObjectMapper;

class BusinessRecordValidationTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PermissionAuthorizer permissions = mock(PermissionAuthorizer.class);
    private final Authentication authentication = UsernamePasswordAuthenticationToken.authenticated("admin@example.test", "ignored", List.of());
    private final BusinessRecordService service = new BusinessRecordService(jdbc, new ObjectMapper(), permissions,
            mock(CommercePromotionService.class), mock(ProductImageService.class));

    @AfterEach
    void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test
    void requiresAValidSupplierAndDateForPurchasesAndExplicitConfirmationForRetroactiveDates() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "inventory", "create")).thenReturn(true);
        String today = LocalDate.now(ZoneId.of("America/Guatemala")).toString();
        String yesterday = LocalDate.now(ZoneId.of("America/Guatemala")).minusDays(1).toString();
        UUID supplier = UUID.randomUUID();
        List<Map<String, Object>> items = List.of(Map.of("productId", UUID.randomUUID().toString(),
                "productName", "Producto de prueba", "quantity", 1, "unitCost", 10));

        BusinessRuleException missing = assertThrows(BusinessRuleException.class,
                () -> service.create("purchases", Map.of("supplier", "Proveedor", "supplierId", supplier.toString(), "items", items)));
        org.junit.jupiter.api.Assertions.assertTrue(missing.getMessage().toLowerCase().contains("fecha"));

        BusinessRuleException retroactive = assertThrows(BusinessRuleException.class,
                () -> service.create("purchases", Map.of("supplier", "Proveedor", "supplierId", supplier.toString(), "date", yesterday, "items", items)));
        org.junit.jupiter.api.Assertions.assertTrue(retroactive.getMessage().contains("Confirma que esta compra"));

        BusinessRuleException invalidLine = assertThrows(BusinessRuleException.class,
                () -> service.create("purchases", Map.of("supplier", "Proveedor", "supplierId", supplier.toString(), "date", yesterday,
                        "confirmHistoricalDate", true, "items", List.of(Map.of("productId", UUID.randomUUID().toString(),
                                "productName", "Producto de prueba", "quantity", 0, "unitCost", 10)))));
        org.junit.jupiter.api.Assertions.assertTrue(invalidLine.getMessage().contains("cantidad"));

        BusinessRuleException decimalQuantity = assertThrows(BusinessRuleException.class,
                () -> service.create("purchases", Map.of("supplier", "Proveedor", "supplierId", supplier.toString(), "date", yesterday,
                        "confirmHistoricalDate", true, "items", List.of(Map.of("productId", UUID.randomUUID().toString(),
                                "productName", "Producto de prueba", "quantity", 1.5, "unitCost", 10)))));
        org.junit.jupiter.api.Assertions.assertTrue(decimalQuantity.getMessage().contains("entero"));

        BusinessRuleException noItems = assertThrows(BusinessRuleException.class,
                () -> service.create("purchases", Map.of("supplier", "Proveedor", "supplierId", supplier.toString(), "date", today, "items", List.of())));
        assertEquals("La compra necesita al menos un producto.", noItems.getMessage());
        verify(jdbc, never()).update(contains("INSERT INTO business_records"), any(Object[].class));
    }

    @Test
    void acceptsACompletePurchaseForTodayAndDoesNotPersistTheUiConfirmationFlag() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "inventory", "create")).thenReturn(true);
        doAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            return sql.contains("FROM suppliers") || sql.contains("FROM supplier_products");
        }).when(jdbc).queryForObject(contains("SELECT EXISTS"), eq(Boolean.class), any(Object[].class));
        String today = LocalDate.now(ZoneId.of("America/Guatemala")).toString();
        UUID supplier = UUID.randomUUID();
        UUID product = UUID.randomUUID();
        List<Map<String, Object>> items = List.of(Map.of("productId", product.toString(),
                "productName", "Producto de prueba", "quantity", 1, "unitCost", 10));

        var created = service.create("purchases", Map.of("supplier", "Proveedor", "supplierId", supplier.toString(),
                "date", today, "items", items, "status", "Pendiente"));

        assertEquals(today, created.data().get("date"));
        org.junit.jupiter.api.Assertions.assertFalse(created.data().containsKey("confirmHistoricalDate"));
        verify(jdbc).update(contains("INSERT INTO business_records"), any(Object[].class));
    }

    @Test
    void rejectsRetroactiveAccountingDateUnlessConfirmedAndKeepsRequiredFields() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "accounting", "create")).thenReturn(true);
        String yesterday = LocalDate.now(ZoneId.of("America/Guatemala")).minusDays(1).toString();

        BusinessRuleException retroactive = assertThrows(BusinessRuleException.class,
                () -> service.create("accounting", Map.of("date", yesterday, "concept", "Pago de servicio", "category", "Servicios",
                        "type", "Egreso", "amount", 25, "status", "Registrado")));
        org.junit.jupiter.api.Assertions.assertTrue(retroactive.getMessage().contains("Confirma que este movimiento"));

        doReturn(false).when(jdbc).queryForObject(contains("SELECT EXISTS"), eq(Boolean.class), any(Object[].class));
        var confirmed = service.create("accounting", Map.of("date", yesterday, "concept", "Pago de servicio", "category", "Servicios",
                "type", "Egreso", "amount", 25, "status", "Registrado", "confirmHistoricalDate", true));
        assertEquals(yesterday, confirmed.data().get("date"));
        org.junit.jupiter.api.Assertions.assertFalse(confirmed.data().containsKey("confirmHistoricalDate"));
        verify(jdbc).update(contains("INSERT INTO business_records"), any(Object[].class));
    }

    @Test
    void rejectsHtmlCustomerNamesForBothCreateAndEdit() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "customers", "create")).thenReturn(true);
        when(permissions.has(authentication, "customers", "edit")).thenReturn(true);
        Map<String, Object> invalid = Map.of("name", "<h1>Cliente</h1>", "email", "cliente@example.test", "status", "Activo");

        BusinessRuleException createError = assertThrows(BusinessRuleException.class, () -> service.create("customers", invalid));
        org.junit.jupiter.api.Assertions.assertTrue(createError.getMessage().contains("solo puede contener letras"));

        UUID id = UUID.randomUUID();
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked") ResultSetExtractor<Map<String, Object>> extractor = invocation.getArgument(1);
            var row = mock(java.sql.ResultSet.class);
            when(row.next()).thenReturn(true);
            when(row.getString(1)).thenReturn("{\"name\":\"Cliente Válido\",\"email\":\"cliente@example.test\",\"status\":\"Activo\"}");
            return extractor.extractData(row);
        }).when(jdbc).query(anyString(), org.mockito.ArgumentMatchers.<ResultSetExtractor<Map<String, Object>>>any(), eq(id), eq("customers"));

        BusinessRuleException editError = assertThrows(BusinessRuleException.class, () -> service.update("customers", id, invalid));
        org.junit.jupiter.api.Assertions.assertTrue(editError.getMessage().contains("solo puede contener letras"));
        verify(jdbc, never()).update(contains("UPDATE business_records"), any(Object[].class));
    }

    @Test
    void rejectsInvalidFormatsAcrossAdministrativeResourcesBeforePersisting() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "products", "create")).thenReturn(true);
        when(permissions.has(authentication, "brands", "create")).thenReturn(true);
        when(permissions.has(authentication, "suppliers", "create")).thenReturn(true);
        when(permissions.has(authentication, "accounting", "create")).thenReturn(true);
        when(permissions.has(authentication, "settings", "edit")).thenReturn(true);

        BusinessRuleException invalidStock = assertThrows(BusinessRuleException.class,
                () -> service.create("products", Map.of("name", "Router 5G", "sku", "ROUTER-5G", "price", 100, "stock", "1e3", "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidStock.getMessage().contains("entero"));

        BusinessRuleException invalidSku = assertThrows(BusinessRuleException.class,
                () -> service.create("products", Map.of("name", "Router 5G", "sku", "SKU con espacios", "price", 100, "stock", 3, "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidSku.getMessage().contains("SKU"));

        BusinessRuleException invalidBrandContact = assertThrows(BusinessRuleException.class,
                () -> service.create("brands", Map.of("name", "3M Audio", "description", "Accesorios de audio",
                        "contact", "contacto@7777", "status", "Activa")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidBrandContact.getMessage().contains("contacto"));

        BusinessRuleException invalidSupplierEmail = assertThrows(BusinessRuleException.class,
                () -> service.create("suppliers", Map.of("name", "Distribuidora 3M", "email", "7777@7777", "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidSupplierEmail.getMessage().contains("correo"));

        BusinessRuleException invalidAmount = assertThrows(BusinessRuleException.class,
                () -> service.create("accounting", Map.of("date", LocalDate.now(ZoneId.of("America/Guatemala")).toString(),
                        "concept", "Servicio", "category", "Servicios", "type", "Egreso", "amount", "1.001", "status", "Registrado")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidAmount.getMessage().contains("dos decimales"));

        BusinessRuleException invalidSettingsPhone = assertThrows(BusinessRuleException.class,
                () -> service.updateBusinessProfileSettings(Map.of("businessName", "NEXO 2026", "contactEmail", "contacto@nexo.gt",
                        "phone", "ABC 5555-1234", "address", "", "notifications", Map.of("orders", true, "stock", true))));
        org.junit.jupiter.api.Assertions.assertTrue(invalidSettingsPhone.getMessage().contains("teléfono"));

        verify(jdbc, never()).update(contains("INSERT INTO business_records"), any(Object[].class));
        verify(jdbc, never()).update(contains("INSERT INTO business_settings"), any(Object[].class));
    }

    @Test
    void validatesContactDescriptionUrlAndNumericBoundariesBeforeSaving() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        for (String module : List.of("products", "brands", "categories", "suppliers", "customers", "accounting")) {
            when(permissions.has(authentication, module, "create")).thenReturn(true);
        }

        BusinessRuleException invalidCategory = assertThrows(BusinessRuleException.class,
                () -> service.create("categories", Map.of("name", "Marca🙂")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidCategory.getMessage().contains("categoría"));
        BusinessRuleException invalidBrandUrl = assertThrows(BusinessRuleException.class,
                () -> service.create("brands", Map.of("name", "NEXO Audio", "description", "Audio", "contact", "ventas@nexo.gt", "website", "ftp://nexo.example.gt")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidBrandUrl.getMessage().contains("HTTP o HTTPS"));
        BusinessRuleException invalidBrandDescription = assertThrows(BusinessRuleException.class,
                () -> service.create("brands", Map.of("name", "NEXO Audio", "description", "Texto\u0001inválido", "contact", "ventas@nexo.gt")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidBrandDescription.getMessage().contains("descripción"));
        BusinessRuleException invalidSupplierPhone = assertThrows(BusinessRuleException.class,
                () -> service.create("suppliers", Map.of("name", "Distribuidora NEXO", "phone", "ABC 5555", "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidSupplierPhone.getMessage().contains("teléfono"));
        BusinessRuleException invalidSupplierContactName = assertThrows(BusinessRuleException.class,
                () -> service.create("suppliers", Map.of("name", "Distribuidora NEXO", "contactPerson", "Ana 3", "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidSupplierContactName.getMessage().contains("persona de contacto"));
        BusinessRuleException invalidSupplierEmail = assertThrows(BusinessRuleException.class,
                () -> service.create("suppliers", Map.of("name", "Distribuidora NEXO", "email", "ventas..gt@nexo.gt", "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidSupplierEmail.getMessage().contains("correo"));

        BusinessRuleException invalidCustomerEmail = assertThrows(BusinessRuleException.class,
                () -> service.create("customers", Map.of("name", "María O'Neill", "email", "maria@dominio.12", "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidCustomerEmail.getMessage().contains("correo"));
        BusinessRuleException invalidCustomerPhone = assertThrows(BusinessRuleException.class,
                () -> service.create("customers", Map.of("name", "María O'Neill", "email", "maria@nexo.gt", "phone", "555-ABCD", "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidCustomerPhone.getMessage().contains("teléfono"));
        BusinessRuleException invalidCustomerStatus = assertThrows(BusinessRuleException.class,
                () -> service.create("customers", Map.of("name", "María O'Neill", "email", "maria@nexo.gt", "phone", "+502 5555-1234", "status", "Desconocido")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidCustomerStatus.getMessage().contains("estado"));

        BusinessRuleException invalidProductDescription = assertThrows(BusinessRuleException.class,
                () -> service.create("products", Map.of("name", "Router NEXO", "sku", "ROUTER-1", "price", 100,
                        "description", "Descripción\u0001inválida", "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidProductDescription.getMessage().contains("descripción"));
        BusinessRuleException invalidIntegerRange = assertThrows(BusinessRuleException.class,
                () -> service.create("products", Map.of("name", "Router NEXO", "sku", "ROUTER-1", "price", 100,
                        "stock", "2147483648", "status", "Activo")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidIntegerRange.getMessage().contains("límite"));
        BusinessRuleException invalidMoneyPrecision = assertThrows(BusinessRuleException.class,
                () -> service.create("accounting", Map.of("date", LocalDate.now(ZoneId.of("America/Guatemala")).toString(),
                        "concept", "Servicio", "category", "Servicios", "type", "Egreso", "amount", new java.math.BigDecimal("1000000000000"), "status", "Registrado")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidMoneyPrecision.getMessage().contains("precisión"));

        verify(jdbc, never()).update(contains("INSERT INTO business_records"), any(Object[].class));
    }

    @Test
    void acceptsValidOptionalFormatsAndReportsLateStatusErrors() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        for (String module : List.of("products", "brands", "categories", "suppliers")) {
            when(permissions.has(authentication, module, "create")).thenReturn(true);
        }

        BusinessRuleException invalidBrandStatus = assertThrows(BusinessRuleException.class,
                () -> service.create("brands", Map.of("name", "NEXO Audio", "description", "Audio 50%", "contact", "+502 5555-1234",
                        "website", "https://nexo.example.gt", "status", "Desconocido")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidBrandStatus.getMessage().contains("estado de la marca"));
        BusinessRuleException invalidCategoryStatus = assertThrows(BusinessRuleException.class,
                () -> service.create("categories", Map.of("name", "Audio", "status", "Desconocido")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidCategoryStatus.getMessage().contains("estado de la categoría"));
        BusinessRuleException invalidSupplierStatus = assertThrows(BusinessRuleException.class,
                () -> service.create("suppliers", Map.of("name", "Distribuidora NEXO", "contactPerson", "Ana O'Neill",
                        "phone", "+502 5555-1234", "email", "compras+nexo@nexo.gt", "status", "Desconocido")));
        org.junit.jupiter.api.Assertions.assertTrue(invalidSupplierStatus.getMessage().contains("estado del proveedor"));
        BusinessRuleException invalidProductBrand = assertThrows(BusinessRuleException.class,
                () -> service.create("products", Map.of("name", "Router NEXO", "sku", "ROUTER-1", "category", "Tecnología",
                        "location", "Bodega 1", "description", "Router inalámbrico", "price", 100, "cost", 50,
                        "stock", 1, "status", "Activo", "brandId", UUID.randomUUID().toString())));
        org.junit.jupiter.api.Assertions.assertTrue(invalidProductBrand.getMessage().contains("marca seleccionada"));

        verify(jdbc, never()).update(contains("INSERT INTO business_records"), any(Object[].class));
    }
}
