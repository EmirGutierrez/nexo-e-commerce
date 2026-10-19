package gt.nexo.commerce.business.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.application.PermissionAuthorizer;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import tools.jackson.databind.ObjectMapper;

class BusinessRecordServicePendingTransferExpirationTest {
    private static final UUID ORDER_ID = UUID.fromString("9e0ca865-5c91-47f1-a7f0-6d90b5de43de");
    private static final UUID PRODUCT_ID = UUID.fromString("4376960c-031b-4a8f-a65a-f08f849992cf");

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final BusinessRecordService service = new BusinessRecordService(jdbc, mapper,
            mock(PermissionAuthorizer.class), mock(CommercePromotionService.class), mock(ProductImageService.class));

    @Test
    void expiresAndReleasesStockForAnUnreviewedTransfer() throws Exception {
        when(jdbc.queryForList(contains("FOR UPDATE OF r SKIP LOCKED"), eq(UUID.class), any(Object[].class)))
                .thenReturn(List.of(ORDER_ID));
        Map<String, Object> orderData = new LinkedHashMap<>();
        orderData.put("customer", "Cliente");
        orderData.put("customerEmail", "cliente@example.test");
        orderData.put("customerPhone", "55550101");
        orderData.put("address", "Zona 1");
        orderData.put("date", "2026-10-14T12:00:00Z");
        orderData.put("status", "Pendiente de pago");
        orderData.put("paymentMethod", "transfer");
        orderData.put("payment", "Transferencia");
        orderData.put("paymentStatus", "Pendiente de verificación");
        orderData.put("orderNumber", "NX-9E0CA865");
        orderData.put("subtotal", new BigDecimal("40.00"));
        orderData.put("discountAmount", BigDecimal.ZERO);
        orderData.put("total", new BigDecimal("40.00"));
        orderData.put("items", List.of(Map.of("productId", PRODUCT_ID.toString(), "productName", "Monitor",
                "sku", "MON-1", "quantity", 2, "unitPrice", new BigDecimal("20.00"),
                "subtotal", new BigDecimal("40.00"))));
        String order = mapper.writeValueAsString(orderData);
        String product = mapper.writeValueAsString(Map.of("name", "Monitor", "sku", "MON-1", "stock", 5,
                "status", "Activo", "price", new BigDecimal("20.00"), "category", "Tecnología"));
        AtomicInteger lockedRecordReads = new AtomicInteger();
        doAnswer(invocation -> {
            ResultSet result = mock(ResultSet.class);
            when(result.next()).thenReturn(true);
            when(result.getString(1)).thenReturn(lockedRecordReads.getAndIncrement() == 0 ? order : product);
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            return extractor.extractData(result);
        }).when(jdbc).query(contains("FOR UPDATE"), any(ResultSetExtractor.class), any(Object[].class));

        assertEquals(1, service.expirePendingTransferOrders());

        ArgumentCaptor<Object[]> updates = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("UPDATE transfer_receipts"), any(Object[].class));
        verify(jdbc).update(contains("INSERT INTO inventory_movements"), any(Object[].class));
        verify(jdbc, atLeast(2)).update(contains("UPDATE business_records SET data"), updates.capture());
        List<String> updatedRecords = updates.getAllValues().stream()
                .map(arguments -> String.valueOf(arguments[0])).toList();
        assertTrue(updatedRecords.stream().anyMatch(updatedRecord -> updatedRecord.contains("\"status\":\"Cancelado\"")
                && updatedRecord.contains("\"paymentStatus\":\"Expirada\"")));
        assertTrue(updatedRecords.stream().anyMatch(updatedRecord -> updatedRecord.contains("\"stock\":7")));
    }

    @Test
    void skipsTheDatabaseWorkWhenThereAreNoExpiredReceipts() {
        when(jdbc.queryForList(contains("FOR UPDATE OF r SKIP LOCKED"), eq(UUID.class), any(Object[].class)))
                .thenReturn(List.of());

        assertEquals(0, service.expirePendingTransferOrders());

        verify(jdbc, org.mockito.Mockito.never()).update(anyString(), any(Object[].class));
    }
}
