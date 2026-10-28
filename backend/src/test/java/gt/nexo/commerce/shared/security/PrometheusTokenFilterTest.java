package gt.nexo.commerce.shared.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class PrometheusTokenFilterTest {
    private static final String TOKEN = "0123456789abcdef0123456789abcdef";

    @Test
    void allowsGetWithMatchingBearerToken() throws ServletException, IOException {
        PrometheusTokenFilter filter = new PrometheusTokenFilter(TOKEN);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/prometheus");
        request.addHeader("Authorization", "Bearer " + TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(HttpServletResponse.SC_OK, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    @Test
    void rejectsMissingOrIncorrectToken() throws ServletException, IOException {
        PrometheusTokenFilter filter = new PrometheusTokenFilter(TOKEN);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/prometheus");
        request.addHeader("Authorization", "Bearer incorrect-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, response.getStatus());
    }

    @Test
    void rejectsNonGetMethodsEvenWithValidToken() throws ServletException, IOException {
        PrometheusTokenFilter filter = new PrometheusTokenFilter(TOKEN);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/actuator/prometheus");
        request.addHeader("Authorization", "Bearer " + TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, response.getStatus());
    }

    @Test
    void refusesWeakTokensAtStartup() {
        assertThrows(IllegalStateException.class, () -> new PrometheusTokenFilter("short"));
    }
}
