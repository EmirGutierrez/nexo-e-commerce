package gt.nexo.commerce.business.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.business.application.BusinessRecordService;
import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

class PublicCheckoutControllerTest {
    private final BusinessRecordService service = mock(BusinessRecordService.class);
    private final PublicCheckoutController controller = new PublicCheckoutController(service);

    @Test
    void forwardsPublicOrderWithItsIdempotencyKey() {
        Map<String, Object> input = Map.of("customerName", "Cliente Demo");
        UUID idempotencyKey = UUID.randomUUID();
        OrderSubmissionResponse expected = new OrderSubmissionResponse("NX-12345678", new BigDecimal("25.00"), "card", "Simulada");
        when(service.createPublicOrder(input, idempotencyKey)).thenReturn(expected);

        assertEquals(expected, controller.createOrder(input, null, idempotencyKey));

        verify(service).createPublicOrder(input, idempotencyKey);
    }

    @Test
    void usesAuthenticatedCustomerIdentityInsteadOfSubmittedContactFields() {
        UUID customerId = UUID.randomUUID();
        UUID idempotencyKey = UUID.randomUUID();
        NexoUserPrincipal principal = mock(NexoUserPrincipal.class);
        when(principal.getRoleCode()).thenReturn("customer");
        when(principal.getDisplayName()).thenReturn("Cuenta Cliente");
        when(principal.getUsername()).thenReturn("cuenta@example.test");
        when(principal.getId()).thenReturn(customerId);
        var authentication = UsernamePasswordAuthenticationToken.authenticated(principal, "ignored", List.of());
        Map<String, Object> input = new HashMap<>(Map.of("customerName", "Manipulado", "customerEmail", "otra@example.test"));
        OrderSubmissionResponse expected = new OrderSubmissionResponse("NX-12345678", BigDecimal.TEN, "card", "Simulada");
        when(service.createCustomerOrder(input, customerId, idempotencyKey)).thenReturn(expected);

        assertEquals(expected, controller.createOrder(input, authentication, idempotencyKey));

        assertEquals("Cuenta Cliente", input.get("customerName"));
        assertEquals("cuenta@example.test", input.get("customerEmail"));
        verify(service).createCustomerOrder(input, customerId, idempotencyKey);
    }

    @Test
    void delegatesQuotesAndMinimalSubmissionRecovery() {
        Map<String, Object> input = Map.of("items", List.of());
        UUID idempotencyKey = UUID.randomUUID();
        OrderQuoteResponse quote = new OrderQuoteResponse(BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.TEN, List.of());
        OrderSubmissionResponse submission = new OrderSubmissionResponse("NX-12345678", BigDecimal.TEN, "card", "Simulada");
        when(service.quotePublicOrder(input)).thenReturn(quote);
        when(service.publicOrderSubmission(idempotencyKey)).thenReturn(submission);

        assertEquals(quote, controller.quoteOrder(input));
        assertEquals(submission, controller.orderSubmission(idempotencyKey));
    }
}
