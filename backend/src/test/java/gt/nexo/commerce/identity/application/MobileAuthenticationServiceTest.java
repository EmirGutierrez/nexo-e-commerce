package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.api.dto.LoginRequest;
import org.junit.jupiter.api.Test;

class MobileAuthenticationServiceTest {
    @Test
    void doesNotIssueMobileTokensForStaffWhoMustEnrollMfaOnWeb() {
        AuthenticationService authentication = mock(AuthenticationService.class);
        MobileSessionService sessions = mock(MobileSessionService.class);
        UserAccountService users = mock(UserAccountService.class);
        MobileAuthenticationService service = new MobileAuthenticationService(authentication, sessions, users);
        MfaChallengeException required = MfaChallengeException.enrollmentRequired();
        when(authentication.authenticateMobile(new LoginRequest("staff@example.test", "password")))
                .thenThrow(required);

        MfaChallengeException error = assertThrows(MfaChallengeException.class,
                () -> service.login(new LoginRequest("staff@example.test", "password")));

        assertEquals("MFA_ENROLLMENT_REQUIRED", error.getCode());
        verifyNoInteractions(sessions, users);
    }
}
