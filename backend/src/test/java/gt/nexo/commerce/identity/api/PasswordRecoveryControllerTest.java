package gt.nexo.commerce.identity.api;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import gt.nexo.commerce.identity.api.dto.PasswordResetCompleteRequest;
import gt.nexo.commerce.identity.api.dto.PasswordResetRequest;
import gt.nexo.commerce.identity.application.PasswordRecoveryService;
import org.junit.jupiter.api.Test;

class PasswordRecoveryControllerTest {
    private final PasswordRecoveryService service = mock(PasswordRecoveryService.class);
    private final PasswordRecoveryController controller = new PasswordRecoveryController(service);

    @Test
    void delegatesResetRequestAndCompletionToTheService() {
        controller.request(new PasswordResetRequest("persona@example.test"));
        controller.complete(new PasswordResetCompleteRequest("single-use-token", "a-new-secure-password"));

        verify(service).requestReset("persona@example.test");
        verify(service).completeReset("single-use-token", "a-new-secure-password");
    }
}
