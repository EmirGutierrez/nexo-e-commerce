package gt.nexo.commerce.shared.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import gt.nexo.commerce.shared.errors.ApiError;
import jakarta.servlet.ServletOutputStream;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.ObjectMapper;

class AuthenticatedSessionLifetimeFilterTest {
    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void startsTheAbsoluteLifetimeForExistingAuthenticatedSessions() throws Exception {
        AuthenticatedSessionLifetimeFilter filter = new AuthenticatedSessionLifetimeFilter(mock(ObjectMapper.class), Duration.ofHours(8));
        MockHttpServletRequest request = authenticatedRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertInstanceOf(Number.class, request.getSession(false).getAttribute(AuthenticatedSessionLifetimeFilter.AUTHENTICATED_AT_ATTRIBUTE));
        assertEquals(200, response.getStatus());
    }

    @Test
    void invalidatesAnAuthenticatedSessionAfterItsAbsoluteLifetime() throws Exception {
        ObjectMapper mapper = mock(ObjectMapper.class);
        AuthenticatedSessionLifetimeFilter filter = new AuthenticatedSessionLifetimeFilter(mapper, Duration.ofMillis(1));
        MockHttpServletRequest request = authenticatedRequest();
        MockHttpSession session = (MockHttpSession) request.getSession(false);
        session.setAttribute(AuthenticatedSessionLifetimeFilter.AUTHENTICATED_AT_ATTRIBUTE, System.currentTimeMillis() - 5_000);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(401, response.getStatus());
        assertTrue(session.isInvalid());
        verify(mapper).writeValue(any(ServletOutputStream.class), any(ApiError.class));
    }

    private MockHttpServletRequest authenticatedRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/business/profile");
        request.setSession(new MockHttpSession());
        NexoUserPrincipal principal = mock(NexoUserPrincipal.class);
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(principal, "ignored", List.of()));
        return request;
    }
}
