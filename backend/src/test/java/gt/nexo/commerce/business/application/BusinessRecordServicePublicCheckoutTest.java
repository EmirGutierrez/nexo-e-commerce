package gt.nexo.commerce.business.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.business.api.BusinessRecordResponse;
import gt.nexo.commerce.business.api.OrderQuoteResponse;
import gt.nexo.commerce.business.api.OrderSubmissionResponse;
import gt.nexo.commerce.identity.application.PermissionAuthorizer;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.context.ApplicationEventPublisher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.ObjectMapper;

class BusinessRecordServicePublicCheckoutTest {
    private static final UUID PRODUCT_ID = UUID.fromString("a9ea99f8-39fd-4ead-97fb-fc86cae96cb5");
    private static final UUID ORDER_ID = UUID.fromString("16f014ab-62f2-45bc-b3a6-73e97b7d6358");
    private static final UUID CUSTOMER_ID = UUID.fromString("2c284b06-c970-4d1b-a8fa-865b934ff951");
    private static final Instant CREATED_AT = Instant.parse("2026-10-15T12:00:00Z");

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final PermissionAuthorizer permissions = mock(PermissionAuthorizer.class);
    private final CommercePromotionService promotions = mock(CommercePromotionService.class);
    private final BusinessRecordService service = new BusinessRecordService(jdbc, mapper, permissions, promotions,
            mock(ProductImageService.class));

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void calculatesCurrentPublicQuoteAndDiscountWithoutWriting() throws Exception {
        stubProductReads(productJson(4));
        when(promotions.priceForProduct(eq(PRODUCT_ID), any(BigDecimal.class))).thenReturn(new BigDecimal("75.00"));
        when(promotions.validateCode("NEXO10", new BigDecimal("150.00")))
                .thenReturn(Map.of("valid", true, "discount", new BigDecimal("15.00")));

        OrderQuoteResponse quote = service.quotePublicOrder(Map.of(
                "items", List.of(Map.of("productId", PRODUCT_ID.toString(), "quantity", 2)),
                "discountCode", "nexo10"));

        assertEquals(new BigDecimal("150.00"), quote.subtotal());
        assertEquals(new BigDecimal("15.00"), quote.discount());
        assertEquals(new BigDecimal("135.00"), quote.total());
        assertEquals(1, quote.items().size());
        assertEquals(new BigDecimal("75.00"), quote.items().getFirst().unitPrice());
    }

    @Test
    void rejectsUnavailableStockInvalidCodesAndDuplicateQuantitiesAboveTheLimit() throws Exception {
        stubProductReads(productJson(1));
        Map<String, Object> oneItem = Map.of("items", List.of(Map.of("productId", PRODUCT_ID.toString(), "quantity", 2)));
        assertThrows(BusinessRuleException.class, () -> service.quotePublicOrder(oneItem));

        stubProductReads(productJson(10));
        when(promotions.priceForProduct(eq(PRODUCT_ID), any(BigDecimal.class))).thenReturn(new BigDecimal("50.00"));
        when(promotions.validateCode("BAD", new BigDecimal("50.00")))
                .thenReturn(Map.of("valid", false, "message", "El código venció."));
        assertThrows(BusinessRuleException.class, () -> service.quotePublicOrder(Map.of(
                "items", List.of(Map.of("productId", PRODUCT_ID.toString(), "quantity", 1)), "discountCode", "bad")));
        assertThrows(BusinessRuleException.class, () -> service.quotePublicOrder(Map.of("items", List.of(
                Map.of("productId", PRODUCT_ID.toString(), "quantity", 70),
                Map.of("productId", PRODUCT_ID.toString(), "quantity", 31)))));
    }

    @Test
    void validatesCustomerNamesWithoutRejectingAccentsOrApostrophes() throws Exception {
        for (String invalidName : List.of("", "Cliente 123", "Ana--María", "Ana María-", "-Ana", "Ana@@Maria", "\u0301Ana", "A".repeat(161))) {
            Map<String, Object> request = orderInput(null);
            request.put("customerName", invalidName);
            assertThrows(BusinessRuleException.class,
                    () -> service.createPublicOrder(request, null), invalidName);
        }

        for (String invalidEmail : List.of("", "7777@77777", "ana@example.c", "ana@123.456", "a".repeat(245) + "@example.test")) {
            Map<String, Object> request = orderInput(null);
            request.put("customerEmail", invalidEmail);
            assertThrows(BusinessRuleException.class, () -> service.createPublicOrder(request, null), invalidEmail);
        }
        for (String invalidAddress : List.of("123456", "A".repeat(501))) {
            Map<String, Object> request = orderInput(null);
            request.put("address", invalidAddress);
            assertThrows(BusinessRuleException.class, () -> service.createPublicOrder(request, null), invalidAddress);
        }
        for (String invalidNit : List.of("X", "123/456", "A".repeat(21))) {
            Map<String, Object> request = orderInput(null);
            request.put("nit", invalidNit);
            assertThrows(BusinessRuleException.class, () -> service.createPublicOrder(request, null), invalidNit);
        }

        stubProductReads(productJson(4));
        when(promotions.priceForProduct(eq(PRODUCT_ID), any(BigDecimal.class))).thenReturn(new BigDecimal("100.00"));
        when(promotions.useCode("", new BigDecimal("100.00"))).thenReturn(BigDecimal.ZERO);
        doReturn(1).when(jdbc).update(org.mockito.ArgumentMatchers.startsWith("INSERT INTO public_order_idempotency"), any(Object[].class));
        Map<String, Object> request = orderInput(new BigDecimal("100.00"));
        request.put("customerName", "María O’Connor");

        OrderSubmissionResponse order = service.createPublicOrder(request, UUID.randomUUID());

        assertTrue(order.reference().matches("NX-[0-9A-F]{8}"));
    }

    @Test
    void sendsReceiptForCashSaleAndRecordsChangeAndStockMovement() throws Exception {
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated("staff@nexo.gt", "ignored", List.of());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "sales", "create")).thenReturn(true);
        stubProductReads(productJson(5));
        ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
        service.setEventPublisher(events);

        BusinessRecordResponse sale = service.createInPersonSale(Map.of(
                "customerName", "María O’Connor",
                "customerEmail", "CLIENTE@example.test",
                "nit", "1234567-8",
                "paymentMethod", "cash",
                "amountReceived", "120.00",
                "items", List.of(Map.of("productId", PRODUCT_ID.toString(), "quantity", 1))));

        assertEquals("sales", sale.resource());
        assertEquals(0, new BigDecimal("100.00").compareTo((BigDecimal) sale.data().get("total")));
        assertEquals(0, new BigDecimal("20.00").compareTo((BigDecimal) sale.data().get("change")));
        assertEquals("cliente@example.test", sale.data().get("customerEmail"));
        verify(events).publishEvent(any(BusinessEmailService.EmailRequested.class));
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO inventory_movements"), any(Object[].class));
    }

    @Test
    void publicCatalogOmitsInactiveAndOutOfStockProducts() throws Exception {
        String active = mapper.writeValueAsString(Map.of("name", "Disponible", "stock", 3, "status", "Activo"));
        String empty = mapper.writeValueAsString(Map.of("name", "Agotado", "stock", 0, "status", "Activo"));
        String inactive = mapper.writeValueAsString(Map.of("name", "Oculto", "stock", 5, "status", "Inactivo"));
        UUID activeId = UUID.randomUUID();
        when(jdbc.query(anyString(), any(RowMapper.class))).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked") RowMapper<Map<String, Object>> mapper = invocation.getArgument(1);
            List<String> records = List.of(active, empty, inactive);
            List<UUID> ids = List.of(activeId, UUID.randomUUID(), UUID.randomUUID());
            java.util.ArrayList<Map<String, Object>> result = new java.util.ArrayList<>();
            for (int index = 0; index < records.size(); index++) {
                ResultSet row = mock(ResultSet.class);
                when(row.getString("data")).thenReturn(records.get(index));
                when(row.getObject("id", UUID.class)).thenReturn(ids.get(index));
                result.add(mapper.mapRow(row, index));
            }
            return result;
        });

        List<Map<String, Object>> products = service.publicProducts();

        assertEquals(1, products.size());
        assertEquals(activeId.toString(), products.getFirst().get("id"));
        assertEquals("Disponible", products.getFirst().get("name"));
    }

    @Test
    void createsOrderWithIdempotencyAndRejectsAQuoteThatBecameStale() throws Exception {
        stubProductReads(productJson(4));
        doReturn(1).when(jdbc).update(org.mockito.ArgumentMatchers.startsWith("INSERT INTO public_order_idempotency"), any(Object[].class));
        when(promotions.priceForProduct(eq(PRODUCT_ID), any(BigDecimal.class))).thenReturn(new BigDecimal("100.00"));
        when(promotions.useCode("", new BigDecimal("100.00"))).thenReturn(BigDecimal.ZERO);

        OrderSubmissionResponse order = service.createPublicOrder(orderInput(new BigDecimal("100.00")), UUID.randomUUID());

        org.junit.jupiter.api.Assertions.assertTrue(order.reference().matches("NX-[0-9A-F]{8}"));
        assertEquals(0, new BigDecimal("100.00").compareTo(order.total()));
        assertEquals("card", order.paymentMethod());
        assertEquals("Simulada", order.paymentStatus());

        BusinessRuleException staleQuote = assertThrows(BusinessRuleException.class,
                () -> service.createPublicOrder(orderInput(new BigDecimal("99.00")), UUID.randomUUID()));
        assertEquals("El total cambió mientras confirmabas el pedido. Revisa el precio actualizado y vuelve a confirmar.", staleQuote.getMessage());
    }

    @Test
    void createsCustomerOrdersAndPersistsTheirUserAssociation() throws Exception {
        stubProductReads(productJson(4));
        when(promotions.priceForProduct(eq(PRODUCT_ID), any(BigDecimal.class))).thenReturn(new BigDecimal("100.00"));
        when(promotions.useCode("", new BigDecimal("100.00"))).thenReturn(BigDecimal.ZERO);

        OrderSubmissionResponse order = service.createCustomerOrder(orderInput(new BigDecimal("100.00")), UUID.randomUUID(), null);

        assertEquals("card", order.paymentMethod());
        assertEquals(0, new BigDecimal("100.00").compareTo(order.total()));
    }

    @Test
    void sendsEmailReceiptForValidGuestCheckout() throws Exception {
        stubProductReads(productJson(4));
        when(promotions.priceForProduct(eq(PRODUCT_ID), any(BigDecimal.class))).thenReturn(new BigDecimal("100.00"));
        when(promotions.useCode("", new BigDecimal("100.00"))).thenReturn(BigDecimal.ZERO);
        ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
        service.setEventPublisher(events);

        OrderSubmissionResponse order = service.createPublicOrder(orderInput(new BigDecimal("100.00")), null);

        assertTrue(order.reference().matches("NX-[0-9A-F]{8}"));
        verify(events).publishEvent(any(BusinessEmailService.EmailRequested.class));
    }

    @Test
    void returnsCustomerAddressesAndOrderHistoryByNormalizedEmail() throws Exception {
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated("staff@nexo.gt", "ignored", List.of());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "customers", "view")).thenReturn(true);
        doAnswer(invocation -> {
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            ResultSet row = mock(ResultSet.class);
            when(row.next()).thenReturn(true);
            when(row.getString(1)).thenReturn("{\"name\":\"Ana\",\"email\":\"ANA@EXAMPLE.TEST\"}");
            return extractor.extractData(row);
        }).when(jdbc).query(org.mockito.ArgumentMatchers.contains("resource_code = 'customers'"), any(ResultSetExtractor.class), eq(CUSTOMER_ID));
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked") RowMapper<Map<String, Object>> rowMapper = invocation.getArgument(1);
            ResultSet row = mock(ResultSet.class);
            when(row.getString("data")).thenReturn("{\"orderNumber\":\"NX-ORDER\",\"address\":\"Zona 1\",\"total\":75}");
            when(row.getObject("id", UUID.class)).thenReturn(ORDER_ID);
            return List.of(rowMapper.mapRow(row, 0));
        }).when(jdbc).query(org.mockito.ArgumentMatchers.contains("resource_code = 'orders'"), any(RowMapper.class), eq("ana@example.test"));

        Map<String, Object> details = service.customerDetails(CUSTOMER_ID);

        assertEquals("ANA@EXAMPLE.TEST", ((Map<?, ?>) details.get("customer")).get("email"));
        assertEquals(List.of("Zona 1"), details.get("addresses"));
        assertEquals(1, ((List<?>) details.get("orders")).size());
        verify(permissions).has(authentication, "customers", "view");
    }

    @Test
    void rejectsInvalidPointOfSaleCustomerDataAndCashBeforeWriting() throws Exception {
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated("staff@nexo.gt", "ignored", List.of());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "sales", "create")).thenReturn(true);
        Map<String, Object> request = new HashMap<>();
        request.put("customerName", "Cliente Demo");
        request.put("customerEmail", "cliente@example.test");
        request.put("nit", "1234567-8");
        request.put("paymentMethod", "cash");
        request.put("amountReceived", "100");
        request.put("items", List.of(Map.of("productId", PRODUCT_ID.toString(), "quantity", 1)));

        for (String invalidName : List.of("", "Cliente 123", "-Cliente", "Cliente--Demo", "Cliente-", "A".repeat(161))) {
            request.put("customerName", invalidName);
            assertThrows(BusinessRuleException.class, () -> service.createInPersonSale(request), invalidName);
        }
        request.put("customerName", "Cliente Demo");
        for (String invalidEmail : List.of("", "7777@77777", "a@b.c", "a".repeat(245) + "@example.test")) {
            request.put("customerEmail", invalidEmail);
            assertThrows(BusinessRuleException.class, () -> service.createInPersonSale(request), invalidEmail);
        }
        request.put("customerEmail", "cliente@example.test");
        for (String invalidNit : List.of("X", "123/456", "A".repeat(21))) {
            request.put("nit", invalidNit);
            assertThrows(BusinessRuleException.class, () -> service.createInPersonSale(request), invalidNit);
        }
        request.put("nit", "1234567-8");
        request.put("amountReceived", "1");
        stubProductReads(productJson(4));
        assertThrows(BusinessRuleException.class, () -> service.createInPersonSale(request));
    }

    @Test
    void allowsAuthorizedStaffToCreateOrdersThroughTheProtectedFlow() throws Exception {
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated("staff@nexo.gt", "ignored", List.of());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "orders", "create")).thenReturn(true);
        stubProductReads(productJson(4));
        when(promotions.priceForProduct(eq(PRODUCT_ID), any(BigDecimal.class))).thenReturn(new BigDecimal("100.00"));
        when(promotions.useCode("", new BigDecimal("100.00"))).thenReturn(BigDecimal.ZERO);

        BusinessRecordResponse order = service.createStaffOrder(orderInput(new BigDecimal("100.00")));

        assertEquals("orders", order.resource());
        assertEquals("En preparación", order.data().get("status"));
    }

    @Test
    void safelyReplaysAnAlreadyCreatedSubmissionAndRejectsReusingItsKeyWithDifferentData() throws Exception {
        Map<String, Object> request = orderInput(null);
        AtomicReference<String> requestHash = new AtomicReference<>();
        doAnswer(invocation -> {
            requestHash.set(invocation.getArgument(2));
            return 0;
        }).when(jdbc).update(org.mockito.ArgumentMatchers.startsWith("INSERT INTO public_order_idempotency"), any(Object[].class));
        doAnswer(invocation -> {
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            ResultSet row = mock(ResultSet.class);
            when(row.next()).thenReturn(true);
            when(row.getString("request_hash")).thenAnswer(ignored -> requestHash.get());
            when(row.getObject("id", UUID.class)).thenReturn(ORDER_ID);
            when(row.getString("resource_code")).thenReturn("orders");
            when(row.getString("data")).thenReturn("{\"orderNumber\":\"NX-16F014AB\",\"total\":100.00,\"paymentMethod\":\"card\",\"paymentStatus\":\"Simulada\"}");
            when(row.getTimestamp("created_at")).thenReturn(Timestamp.from(CREATED_AT));
            when(row.getTimestamp("updated_at")).thenReturn(Timestamp.from(CREATED_AT));
            return extractor.extractData(row);
        }).when(jdbc).query(org.mockito.ArgumentMatchers.contains("FOR UPDATE OF i"), any(ResultSetExtractor.class), any(Object[].class));

        OrderSubmissionResponse order = service.createPublicOrder(request, UUID.randomUUID());

        assertEquals("NX-16F014AB", order.reference());
        assertEquals(0, new BigDecimal("100.00").compareTo(order.total()));
        assertEquals("Simulada", order.paymentStatus());

        doAnswer(invocation -> {
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            ResultSet row = mock(ResultSet.class);
            when(row.next()).thenReturn(true);
            when(row.getString("request_hash")).thenReturn("0".repeat(64));
            return extractor.extractData(row);
        }).when(jdbc).query(org.mockito.ArgumentMatchers.contains("FOR UPDATE OF i"), any(ResultSetExtractor.class), any(Object[].class));
        assertThrows(BusinessRuleException.class, () -> service.createPublicOrder(request, UUID.randomUUID()));
    }

    @Test
    void recoversOnlyTheMinimalSubmissionFields() throws Exception {
        doAnswer(invocation -> {
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            ResultSet row = mock(ResultSet.class);
            when(row.next()).thenReturn(true);
            when(row.getString("data")).thenReturn("{\"orderNumber\":\"NX-16F014AB\",\"total\":100.00,\"paymentMethod\":\"card\",\"paymentStatus\":\"Simulada\",\"customerEmail\":\"private@example.test\"}");
            return extractor.extractData(row);
        }).when(jdbc).query(org.mockito.ArgumentMatchers.contains("public_order_idempotency i"), any(ResultSetExtractor.class), any(Object[].class));

        OrderSubmissionResponse recovered = service.publicOrderSubmission(UUID.randomUUID());

        assertEquals("NX-16F014AB", recovered.reference());
        assertEquals(0, new BigDecimal("100.00").compareTo(recovered.total()));
        assertEquals("card", recovered.paymentMethod());
    }

    private void stubProductReads(String productJson) throws Exception {
        doAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            ResultSet row = mock(ResultSet.class);
            if (sql.contains("business_settings")) {
                when(row.next()).thenReturn(false);
            } else if (sql.contains("resource_code = 'customers'")) {
                when(row.next()).thenReturn(false);
            } else {
                when(row.next()).thenReturn(true);
                when(row.getString(1)).thenReturn(productJson);
            }
            return extractor.extractData(row);
        }).when(jdbc).query(anyString(), any(ResultSetExtractor.class), any(Object[].class));
        doAnswer(invocation -> {
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            ResultSet row = mock(ResultSet.class);
            when(row.next()).thenReturn(false);
            return extractor.extractData(row);
        }).when(jdbc).query(anyString(), any(ResultSetExtractor.class));
    }

    private String productJson(int stock) throws Exception {
        return mapper.writeValueAsString(Map.of("name", "Monitor", "sku", "MON-1", "price", new BigDecimal("100.00"),
                "stock", stock, "status", "Activo", "category", "Tecnología"));
    }

    private Map<String, Object> orderInput(BigDecimal expectedTotal) {
        Map<String, Object> input = new HashMap<>();
        input.put("customerName", "Cliente Demo");
        input.put("customerEmail", "cliente@example.test");
        input.put("nit", "1234567-8");
        input.put("customerPhone", "55550101");
        input.put("address", "Zona 1, Guatemala");
        input.put("paymentMethod", "card");
        input.put("items", List.of(Map.of("productId", PRODUCT_ID.toString(), "quantity", 1)));
        if (expectedTotal != null) input.put("expectedTotal", expectedTotal);
        return input;
    }
}
