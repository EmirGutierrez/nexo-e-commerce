package gt.nexo.commerce.business.application;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

import gt.nexo.commerce.business.api.BusinessRecordResponse;
import gt.nexo.commerce.identity.application.PermissionAuthorizer;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.ObjectMapper;

class BusinessRecordServiceInventoryPermissionTest {
    private final JdbcTemplate jdbc = org.mockito.Mockito.mock(JdbcTemplate.class);
    private final ObjectMapper mapper = org.mockito.Mockito.mock(ObjectMapper.class);
    private final PermissionAuthorizer permissions = org.mockito.Mockito.mock(PermissionAuthorizer.class);
    private final CommercePromotionService promotions = org.mockito.Mockito.mock(CommercePromotionService.class);
    private final ProductImageService productImages = org.mockito.Mockito.mock(ProductImageService.class);
    private final BusinessRecordService service = new BusinessRecordService(jdbc, mapper, permissions, promotions, productImages);
    private final Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
            "staff@nexo.gt", "ignored", List.of());

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listsProductsWithTheInventoryViewPermission() {
        List<BusinessRecordResponse> records = List.of();
        when(permissions.has(authentication, "inventory", "view")).thenReturn(true);
        doReturn(records).when(jdbc).query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<BusinessRecordResponse>>any());

        assertSame(records, service.listInventoryProducts());

        verify(permissions).has(authentication, "inventory", "view");
        verify(jdbc).query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<BusinessRecordResponse>>any());
    }

    @Test
    void mapsInventoryProductRowsReturnedByTheDatabase() throws Exception {
        UUID id = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-10-15T12:00:00Z");
        Instant updatedAt = createdAt.plusSeconds(30);
        Map<String, Object> data = Map.of("name", "Monitor");
        when(permissions.has(authentication, "inventory", "view")).thenReturn(true);
        when(mapper.readValue(anyString(), eq(Map.class))).thenReturn(data);
        doAnswer(invocation -> {
            RowMapper<BusinessRecordResponse> rowMapper = invocation.getArgument(1);
            ResultSet rs = org.mockito.Mockito.mock(ResultSet.class);
            when(rs.getObject("id", UUID.class)).thenReturn(id);
            when(rs.getString("resource_code")).thenReturn("products");
            when(rs.getString("data")).thenReturn("{}");
            when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(createdAt));
            when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(updatedAt));
            return List.of(rowMapper.mapRow(rs, 0));
        }).when(jdbc).query(anyString(), org.mockito.ArgumentMatchers.<RowMapper<BusinessRecordResponse>>any());

        List<BusinessRecordResponse> records = service.listInventoryProducts();

        org.junit.jupiter.api.Assertions.assertEquals(1, records.size());
        org.junit.jupiter.api.Assertions.assertEquals(id, records.getFirst().id());
        org.junit.jupiter.api.Assertions.assertEquals(data, records.getFirst().data());
        org.junit.jupiter.api.Assertions.assertEquals(createdAt, records.getFirst().createdAt());
        org.junit.jupiter.api.Assertions.assertEquals(updatedAt, records.getFirst().updatedAt());
    }

    @Test
    void deniesInventoryProductListingWithoutInventoryViewPermission() {
        when(permissions.has(authentication, "inventory", "view")).thenReturn(false);

        assertThrows(AccessDeniedException.class, service::listInventoryProducts);

        verify(permissions).has(authentication, "inventory", "view");
        verifyNoInteractions(jdbc);
    }

    @Test
    void deniesInventoryProductUpdatesWithoutInventoryEditPermission() {
        when(permissions.has(authentication, "inventory", "edit")).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> service.updateInventoryProduct(UUID.randomUUID(), Map.of()));

        verify(permissions).has(authentication, "inventory", "edit");
        verifyNoInteractions(jdbc);
    }

    @Test
    void acceptsMissingBlankAndPositiveOptionalCostsForInventoryUpdates() throws Exception {
        UUID id = UUID.randomUUID();
        Map<String, Object> previous = Map.of("name", "Monitor", "sku", "MON-1", "price", 149, "stock", 8, "status", "Activo");
        when(permissions.has(authentication, "inventory", "edit")).thenReturn(true);
        when(mapper.readValue(anyString(), eq(Map.class))).thenReturn(previous);
        when(mapper.writeValueAsString(any())).thenReturn("{}");
        doReturn(false).when(jdbc).queryForObject(anyString(), eq(Boolean.class), any(Object[].class));
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));
        Timestamp timestamp = Timestamp.from(Instant.parse("2026-10-15T12:00:00Z"));
        doReturn(Map.of("created_at", timestamp, "updated_at", timestamp))
                .when(jdbc).queryForMap(anyString(), any(Object[].class));
        doAnswer(invocation -> {
            ResultSetExtractor<Map<String, Object>> extractor = invocation.getArgument(1);
            ResultSet rs = org.mockito.Mockito.mock(ResultSet.class);
            when(rs.next()).thenReturn(true);
            when(rs.getString(1)).thenReturn("{}");
            return extractor.extractData(rs);
        }).when(jdbc).query(anyString(), org.mockito.ArgumentMatchers.<ResultSetExtractor<Map<String, Object>>>any(), eq(id), eq("products"));

        Map<String, Object> withoutCost = new HashMap<>(previous);
        Map<String, Object> blankCost = new HashMap<>(previous);
        blankCost.put("cost", "");
        Map<String, Object> positiveCost = new HashMap<>(previous);
        positiveCost.put("cost", 50);

        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> service.updateInventoryProduct(id, withoutCost));
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> service.updateInventoryProduct(id, blankCost));
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> service.updateInventoryProduct(id, positiveCost));
    }

    @Test
    void rejectsNonpositiveOptionalCostBeforeWritingAProduct() throws Exception {
        Map<String, Object> input = Map.of("name", "Monitor", "sku", "MON-1", "price", 149, "cost", -1);
        when(permissions.has(authentication, "products", "create")).thenReturn(true);
        when(mapper.writeValueAsString(any())).thenReturn("{}");
        doReturn(input).when(mapper).readValue(anyString(), eq(Map.class));

        assertThrows(BusinessRuleException.class, () -> service.create("products", input));

        verifyNoInteractions(jdbc);
    }
}
