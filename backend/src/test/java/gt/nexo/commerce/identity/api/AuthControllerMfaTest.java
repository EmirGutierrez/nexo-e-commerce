package gt.nexo.commerce.identity.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.api.dto.MfaCodeRequest;
import gt.nexo.commerce.identity.api.dto.MfaDisableRequest;
import gt.nexo.commerce.identity.api.dto.MfaEnrollmentResponse;
import gt.nexo.commerce.identity.api.dto.MfaEnrollmentStartRequest;
import gt.nexo.commerce.identity.api.dto.MfaRecoveryCodesResponse;
import gt.nexo.commerce.identity.api.dto.MfaStatusResponse;
import gt.nexo.commerce.identity.application.AuthenticationService;
import gt.nexo.commerce.identity.application.CustomerRegistrationService;
import gt.nexo.commerce.identity.application.MfaService;
import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import gt.nexo.commerce.identity.application.TeamInvitationService;
import gt.nexo.commerce.identity.application.UserAccountService;
import gt.nexo.commerce.shared.security.MfaSessionVerification;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;

class AuthControllerMfaTest {
    private static final UUID USER_ID = UUID.fromString("bc1001d4-b5d6-488f-b376-c3e7c286613d");
    private static final String EMAIL = "admin@example.test";

    private final AuthenticationService authenticationService = mock(AuthenticationService.class);
    private final UserAccountService userAccountService = mock(UserAccountService.class);
    private final CustomerRegistrationService registrationService = mock(CustomerRegistrationService.class);
    private final SecurityContextLogoutHandler logoutHandler = mock(SecurityContextLogoutHandler.class);
    private final TeamInvitationService invitations = mock(TeamInvitationService.class);
    private final MfaService mfa = mock(MfaService.class);
    private final AuthController controller = new AuthController(authenticationService, userAccountService,
            registrationService, logoutHandler, invitations, mfa);

    @Test
    void delegatesAuthenticatedMfaStatusAndEnrollmentOperationsToTheAccountService() {
        Authentication authentication = authentication();
        MfaStatusResponse status = new MfaStatusResponse(true, false, 8);
        MfaEnrollmentResponse enrollment = new MfaEnrollmentResponse("BASE32", "otpauth://totp/NEXO");
        List<String> recoveryCodes = List.of("AAAAA-BBBBB-CCCCC-DDDDD");
        when(mfa.status(USER_ID)).thenReturn(status);
        when(mfa.beginEnrollment(USER_ID, EMAIL, "password")).thenReturn(enrollment);
        when(mfa.completeEnrollment(USER_ID, "123456")).thenReturn(recoveryCodes);
        when(mfa.rotateRecoveryCodes(USER_ID, "password", "654321")).thenReturn(recoveryCodes);
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.getSession(true);

        assertEquals(status, controller.mfaStatus(authentication));
        assertEquals(enrollment, controller.beginMfaEnrollment(authentication, new MfaEnrollmentStartRequest("password")));
        assertEquals(new MfaRecoveryCodesResponse(recoveryCodes),
                controller.completeMfaEnrollment(authentication, new MfaCodeRequest("123456"), servletRequest));
        assertEquals(USER_ID.toString(), servletRequest.getSession(false)
                .getAttribute(MfaSessionVerification.VERIFIED_USER_ATTRIBUTE));
        assertEquals(new MfaRecoveryCodesResponse(recoveryCodes), controller.rotateMfaRecoveryCodes(authentication,
                new MfaDisableRequest("password", "654321")));
        controller.disableMfa(authentication, new MfaDisableRequest("password", "123456"));

        verify(mfa).disable(USER_ID, "password", "123456");
    }

    private static Authentication authentication() {
        NexoUserPrincipal principal = mock(NexoUserPrincipal.class);
        when(principal.getId()).thenReturn(USER_ID);
        when(principal.getUsername()).thenReturn(EMAIL);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(principal);
        return authentication;
    }
}
