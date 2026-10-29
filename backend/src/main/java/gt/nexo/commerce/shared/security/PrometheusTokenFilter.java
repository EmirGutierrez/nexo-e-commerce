package gt.nexo.commerce.shared.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.OncePerRequestFilter;

final class PrometheusTokenFilter extends OncePerRequestFilter {
    private static final String AUTHORIZATION_PREFIX = "Bearer ";
    private final byte[] expectedToken;

    PrometheusTokenFilter(String expectedToken) {
        if (expectedToken == null || expectedToken.length() < 32) {
            throw new IllegalStateException("PROMETHEUS_SCRAPE_TOKEN debe tener al menos 32 caracteres.");
        }
        this.expectedToken = expectedToken.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (!"GET".equals(request.getMethod()) || authorization == null
                || !authorization.startsWith(AUTHORIZATION_PREFIX)
                || !MessageDigest.isEqual(expectedToken,
                        authorization.substring(AUTHORIZATION_PREFIX.length()).getBytes(StandardCharsets.UTF_8))) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        filterChain.doFilter(request, response);
    }
}
