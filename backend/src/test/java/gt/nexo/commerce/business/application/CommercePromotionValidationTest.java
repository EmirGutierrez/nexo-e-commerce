package gt.nexo.commerce.business.application;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.application.PermissionAuthorizer;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

class CommercePromotionValidationTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PermissionAuthorizer permissions = mock(PermissionAuthorizer.class);
    private final Authentication authentication = UsernamePasswordAuthenticationToken.authenticated("admin@example.test", "ignored", List.of());
    private final CommercePromotionService service = new CommercePromotionService(jdbc, permissions);

    @AfterEach
    void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test
    void rejectsExcessDecimalPrecisionBeforePersistingPromotionData() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "promotions", "edit")).thenReturn(true);
        Map<String, Object> code = Map.of(
                "id", "code-1", "code", "NEXO10", "discountPercent", 10, "minPurchase", "12.345",
                "maxUses", 10, "usedCount", 0, "startsAt", "2026-01-01", "endsAt", "2027-01-01", "status", "Activo");

        BusinessRuleException error = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(), "discountCodes", List.of(code))));

        assertTrue(error.getMessage().contains("dos decimales"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void rejectsScientificNotationAndDecimalTokensForIntegerPromotionFields() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "promotions", "edit")).thenReturn(true);
        Map<String, Object> code = Map.of(
                "id", "code-2", "code", "NEXO20", "discountPercent", "1e1", "minPurchase", 0,
                "maxUses", 10, "usedCount", 0, "startsAt", "2026-01-01", "endsAt", "2027-01-01", "status", "Activo");

        BusinessRuleException error = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(), "discountCodes", List.of(code))));

        assertTrue(error.getMessage().contains("entero"));
        verifyNoInteractions(jdbc);

        Map<String, Object> decimalCode = Map.of(
                "id", "code-3", "code", "NEXO30", "discountPercent", 10.0, "minPurchase", 0,
                "maxUses", 10, "usedCount", 0, "startsAt", "2026-01-01", "endsAt", "2027-01-01", "status", "Activo");
        BusinessRuleException decimalError = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(), "discountCodes", List.of(decimalCode))));
        assertTrue(decimalError.getMessage().contains("entero"));
        verifyNoInteractions(jdbc);
    }
}