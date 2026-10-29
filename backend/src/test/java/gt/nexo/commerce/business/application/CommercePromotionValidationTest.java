package gt.nexo.commerce.business.application;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.application.PermissionAuthorizer;
import java.math.BigDecimal;
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

    @Test
    void validatesAnnouncementTextLinksImagesAndStatusBeforePersisting() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "promotions", "edit")).thenReturn(true);

        Map<String, Object> controlCharacter = Map.of("id", "announcement-1", "title", "Nueva colección",
                "description", "Texto\u0001inválido", "href", "/store", "status", "Activa");
        BusinessRuleException invalidText = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(controlCharacter), "discountCodes", List.of())));
        assertTrue(invalidText.getMessage().contains("texto y un enlace interno"));

        Map<String, Object> externalPath = Map.of("id", "announcement-2", "title", "Nueva colección",
                "description", "Productos nuevos", "href", "//example.test", "status", "Activa");
        BusinessRuleException invalidPath = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(externalPath), "discountCodes", List.of())));
        assertTrue(invalidPath.getMessage().contains("enlace interno"));

        Map<String, Object> invalidImage = Map.of("id", "announcement-3", "title", "Nueva colección",
                "description", "Productos nuevos", "href", "/store", "image", "data:image/jpeg;base64,***", "status", "Activa");
        BusinessRuleException invalidImageError = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(invalidImage), "discountCodes", List.of())));
        assertTrue(invalidImageError.getMessage().contains("JPG, PNG o WEBP"));

        Map<String, Object> validImageAndText = Map.of("id", "announcement-4", "title", "Nueva colección",
                "description", "Productos nuevos", "href", "/store", "image", "data:image/jpeg;base64,AAAA", "status", "Pendiente");
        BusinessRuleException invalidStatus = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(validImageAndText), "discountCodes", List.of())));
        assertTrue(invalidStatus.getMessage().contains("estado del anuncio"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void validatesPromotionMoneyPrecisionAndDuplicateCodes() {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        when(permissions.has(authentication, "promotions", "edit")).thenReturn(true);

        Map<String, Object> oversizedAmount = Map.of("id", "code-10", "code", "NEXO10", "discountPercent", 10,
                "minPurchase", new BigDecimal("1000000000000"), "maxUses", 10, "usedCount", 0,
                "startsAt", "2026-01-01", "endsAt", "2027-01-01", "status", "Activo");
        BusinessRuleException precisionError = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(), "discountCodes", List.of(oversizedAmount))));
        assertTrue(precisionError.getMessage().contains("precisión permitida"));

        Map<String, Object> invalidStatus = Map.of("id", "code-11", "code", "NEXO11", "discountPercent", 10,
                "minPurchase", new BigDecimal("12.34"), "maxUses", 10, "usedCount", 0,
                "startsAt", "2026-01-01", "endsAt", "2027-01-01", "status", "Desconocido");
        BusinessRuleException statusError = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(), "discountCodes", List.of(invalidStatus))));
        assertTrue(statusError.getMessage().contains("estado del código"));

        Map<String, Object> duplicate = new java.util.HashMap<>(invalidStatus);
        duplicate.put("status", "Activo");
        Map<String, Object> second = new java.util.HashMap<>(duplicate);
        second.put("id", "code-12");
        BusinessRuleException duplicateError = assertThrows(BusinessRuleException.class,
                () -> service.saveData(Map.of("offers", List.of(), "announcements", List.of(), "discountCodes", List.of(duplicate, second))));
        assertTrue(duplicateError.getMessage().contains("repetido"));
        verifyNoInteractions(jdbc);
    }
}
