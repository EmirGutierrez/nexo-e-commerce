package gt.nexo.commerce.business.application;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
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
    void rejectsNonpositiveOptionalCostBeforeWritingAProduct() throws Exception {
        Map<String, Object> input = Map.of("name", "Monitor", "sku", "MON-1", "price", 149, "cost", -1);
        when(permissions.has(authentication, "products", "create")).thenReturn(true);
        when(mapper.writeValueAsString(any())).thenReturn("{}");
        doReturn(input).when(mapper).readValue(anyString(), eq(Map.class));

        assertThrows(BusinessRuleException.class, () -> service.create("products", input));

        verifyNoInteractions(jdbc);
    }
}
