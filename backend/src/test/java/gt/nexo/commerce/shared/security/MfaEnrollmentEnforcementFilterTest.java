package gt.nexo.commerce.shared.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.application.MfaService;
import gt.nexo.commerce.identity.application.MobileTokenAuthenticationDetails;
import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import jakarta.servlet.FilterChain;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.ObjectMapper;

class MfaEnrollmentEnforcementFilterTest {
    private final UUID userId = UUID.randomUUID();
    private final MfaService mfaService = mock(MfaService.class);
    private final MfaEnrollmentEnforcementFilter filter = new MfaEnrollmentEnforcementFilter(new ObjectMapper(), mfaService);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void blocksStaffApiRequestsUntilEnrollmentAndReturnsAnActionableCode() throws Exception {
        authenticateStaff();
        when(mfaService.accessState(userId)).thenReturn(new MfaService.MfaAccessState(true, true, false));
        MockHttpServletRequest request = request("GET", "/api/business/products");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean continued = new AtomicBoolean();

        filter.doFilter(request, response, (incoming, outgoing) -> continued.set(true));

        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("MFA_ENROLLMENT_REQUIRED"));
        assertTrue(!continued.get());
        verify(mfaService).accessState(userId);
    }

    @Test
    void allowsOnlyEnrollmentSessionSupportAndPublicStoreRequestsWhileRestricted() throws Exception {
        authenticateStaff();
        when(mfaService.accessState(userId)).thenReturn(new MfaService.MfaAccessState(true, true, false));

        for (String[] route : List.of(
                new String[] {"GET", "/api/auth/me"},
                new String[] {"GET", "/api/auth/mfa"},
                new String[] {"POST", "/api/auth/mfa/enroll/start"},
                new String[] {"POST", "/api/auth/mfa/enroll/complete"},
                new String[] {"POST", "/api/auth/logout"},
                new String[] {"GET", "/api/auth/csrf"},
                new String[] {"GET", "/api/catalog/products"},
                new String[] {"POST", "/api/catalog/orders"})) {
            AtomicBoolean continued = new AtomicBoolean();
            MockHttpServletResponse response = new MockHttpServletResponse();
            FilterChain chain = (incoming, outgoing) -> continued.set(true);

            filter.doFilter(request(route[0], route[1]), response, chain);

            assertTrue(continued.get(), route[0] + " " + route[1] + " should be allowed");
            assertEquals(200, response.getStatus());
        }
    }

    @Test
    void allowsFullyEnrolledSessions() throws Exception {
        authenticateStaff();
        when(mfaService.accessState(userId)).thenReturn(new MfaService.MfaAccessState(true, true, true));
        MockHttpServletRequest request = request("GET", "/api/business/products");
        MfaSessionVerification.markVerified(request.getSession(true), userId);
        AtomicBoolean continued = new AtomicBoolean();
        filter.doFilter(request, new MockHttpServletResponse(),
                (incoming, outgoing) -> continued.set(true));
        assertTrue(continued.get());
        verify(mfaService).accessState(userId);
    }

    @Test
    void requiresMfaAgainForAWebSessionCreatedBeforeSecondFactorVerification() throws Exception {
        authenticateStaff();
        when(mfaService.accessState(userId)).thenReturn(new MfaService.MfaAccessState(true, true, true));
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean continued = new AtomicBoolean();

        filter.doFilter(request("GET", "/api/business/products"), response,
                (incoming, outgoing) -> continued.set(true));

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("MFA_REAUTHENTICATION_REQUIRED"));
        assertTrue(!continued.get());
    }

    @Test
    void rejectsMobileTokensCreatedBeforeMfaWasEnabled() throws Exception {
        authenticateStaff();
        var authentication = (UsernamePasswordAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        authentication.setDetails(new MobileTokenAuthenticationDetails("token-hash"));
        when(mfaService.accessState(userId)).thenReturn(new MfaService.MfaAccessState(true, true, true));
        when(mfaService.isMobileTokenVerified(userId, "token-hash")).thenReturn(false);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean continued = new AtomicBoolean();

        filter.doFilter(request("GET", "/api/mobile/auth/me"), response,
                (incoming, outgoing) -> continued.set(true));

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("MFA_REAUTHENTICATION_REQUIRED"));
        assertTrue(!continued.get());
        verify(mfaService).isMobileTokenVerified(userId, "token-hash");
    }

    @Test
    void ignoresUnauthenticatedRequests() throws Exception {
        AtomicBoolean continued = new AtomicBoolean();
        filter.doFilter(request("GET", "/api/business/products"), new MockHttpServletResponse(),
                (incoming, outgoing) -> continued.set(true));

        assertTrue(continued.get());
        verify(mfaService, never()).accessState(userId);
    }

    private void authenticateStaff() {
        NexoUserPrincipal principal = mock(NexoUserPrincipal.class);
        when(principal.getId()).thenReturn(userId);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    private static MockHttpServletRequest request(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        return request;
    }
}
