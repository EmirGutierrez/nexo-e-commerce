package gt.nexo.commerce.shared.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import gt.nexo.commerce.shared.errors.ApiError;
import jakarta.servlet.ServletOutputStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockFilterChain;
import tools.jackson.databind.ObjectMapper;

class AnonymousRequestRateLimitFilterTest {
    @Test
    void separatesVisitorsByForwardedClientIpWhenTheyShareTheReverseProxy() throws Exception {
        AnonymousRequestRateLimitFilter filter = new AnonymousRequestRateLimitFilter(mock(ObjectMapper.class));

        for (int attempt = 0; attempt < 12; attempt++) {
            MockHttpServletRequest request = orderRequest("198.51.100.10");
            request.addHeader("X-Forwarded-For", "203.0.113.10");
            filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        }

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpServletRequest otherVisitor = orderRequest("198.51.100.10");
        otherVisitor.addHeader("X-Forwarded-For", "203.0.113.11");
        filter.doFilter(otherVisitor, response, new MockFilterChain());

        assertEquals(200, response.getStatus());
    }

    @Test
    void limitsPublicOrderWritesByClientAndReturnsRetryAfter() throws Exception {
        ObjectMapper mapper = mock(ObjectMapper.class);
        AnonymousRequestRateLimitFilter filter = new AnonymousRequestRateLimitFilter(mapper);
        MockHttpServletResponse lastResponse = null;

        for (int attempt = 0; attempt < 13; attempt++) {
            MockHttpServletRequest request = orderRequest("203.0.113.10");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, new MockFilterChain());
            lastResponse = response;
        }

        assertEquals(429, lastResponse.getStatus());
        assertEquals("600", lastResponse.getHeader("Retry-After"));
        assertEquals("application/json", lastResponse.getContentType());
        verify(mapper).writeValue(any(ServletOutputStream.class), any(ApiError.class));
    }

    @Test
    void fallsBackToTheProxyAddressWhenForwardedIpIsMalformed() throws Exception {
        AnonymousRequestRateLimitFilter filter = new AnonymousRequestRateLimitFilter(mock(ObjectMapper.class));
        MockHttpServletResponse lastResponse = null;

        for (int attempt = 0; attempt < 13; attempt++) {
            MockHttpServletRequest request = orderRequest("203.0.113.25");
            request.addHeader("X-Forwarded-For", ":");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, new MockFilterChain());
            lastResponse = response;
        }

        assertEquals(429, lastResponse.getStatus());
    }

    @Test
    void appliesTheSeparateQuoteLimit() throws Exception {
        AnonymousRequestRateLimitFilter filter = new AnonymousRequestRateLimitFilter(mock(ObjectMapper.class));
        MockHttpServletResponse lastResponse = null;

        for (int attempt = 0; attempt < 81; attempt++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/catalog/orders/quote");
            request.setServletPath("/api/catalog/orders/quote");
            request.setRemoteAddr("203.0.113.30");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, new MockFilterChain());
            lastResponse = response;
        }

        assertEquals(429, lastResponse.getStatus());
        assertEquals("600", lastResponse.getHeader("Retry-After"));
    }

    @Test
    void boundsTheNumberOfRememberedAddressesAndReturnsRetryAfterWhenFull() throws Exception {
        AnonymousRequestRateLimitFilter filter = new AnonymousRequestRateLimitFilter(mock(ObjectMapper.class));
        MockHttpServletResponse lastResponse = null;

        for (int address = 0; address <= 20_000; address++) {
            int a = address >>> 16 & 255;
            int b = address >>> 8 & 255;
            int c = address & 255;
            MockHttpServletRequest request = orderRequest("10." + a + "." + b + "." + c);
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, new MockFilterChain());
            lastResponse = response;
        }

        assertEquals(429, lastResponse.getStatus());
        assertEquals("600", lastResponse.getHeader("Retry-After"));
    }

    @Test
    void sharesAuthenticationLimitAcrossWebAndMobileEndpoints() throws Exception {
        AnonymousRequestRateLimitFilter filter = new AnonymousRequestRateLimitFilter(mock(ObjectMapper.class));
        MockHttpServletResponse lastResponse = null;

        for (int attempt = 0; attempt < 11; attempt++) {
            String path = attempt % 2 == 0 ? "/api/auth/login" : "/api/mobile/auth/login";
            MockHttpServletRequest request = postRequest(path, "203.0.113.44");
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, new MockFilterChain());
            lastResponse = response;
        }

        assertEquals(429, lastResponse.getStatus());
        assertEquals("600", lastResponse.getHeader("Retry-After"));
    }

    @Test
    void rateLimitsRegistrationBeforeItReachesTheController() throws Exception {
        AnonymousRequestRateLimitFilter filter = new AnonymousRequestRateLimitFilter(mock(ObjectMapper.class));
        MockHttpServletResponse lastResponse = null;

        for (int attempt = 0; attempt < 9; attempt++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(postRequest("/api/auth/register", "203.0.113.45"), response, new MockFilterChain());
            lastResponse = response;
        }

        assertEquals(429, lastResponse.getStatus());
    }

    @Test
    void rateLimitsPasswordResetRequestsByClientIp() throws Exception {
        AnonymousRequestRateLimitFilter filter = new AnonymousRequestRateLimitFilter(mock(ObjectMapper.class));
        MockHttpServletResponse lastResponse = null;

        for (int attempt = 0; attempt < 6; attempt++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(postRequest("/api/auth/password-reset/request", "203.0.113.46"), response, new MockFilterChain());
            lastResponse = response;
        }

        assertEquals(429, lastResponse.getStatus());
        assertEquals("600", lastResponse.getHeader("Retry-After"));
    }

    @Test
    void groupsIpv6VisitorsByNetworkPrefixToLimitAddressRotation() throws Exception {
        AnonymousRequestRateLimitFilter filter = new AnonymousRequestRateLimitFilter(mock(ObjectMapper.class));

        for (int attempt = 0; attempt < 12; attempt++) {
            MockHttpServletRequest request = orderRequest("2001:db8:1::" + (attempt + 1));
            filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        }

        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(orderRequest("2001:db8:1::100"), response, new MockFilterChain());
        assertEquals(429, response.getStatus());
    }

    private MockHttpServletRequest orderRequest(String remoteAddress) {
        return postRequest("/api/catalog/orders", remoteAddress);
    }

    private MockHttpServletRequest postRequest(String path, String remoteAddress) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setServletPath(path);
        request.setRemoteAddr(remoteAddress);
        return request;
    }
}
