package gt.nexo.commerce.shared.security;

import gt.nexo.commerce.shared.errors.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/** Bounds anonymous checkout traffic before it can write orders or consume inventory. */
final class PublicOrderRateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_MILLIS = 10 * 60 * 1000L;
    private static final int ORDER_LIMIT = 20;
    private static final int QUOTE_LIMIT = 80;
    private static final int MAX_BUCKETS = 20_000;

    private final ObjectMapper mapper;
    private final Map<String, Window> windows = new HashMap<>();
    private long checkedRequests;

    PublicOrderRateLimitFilter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())) return true;
        String path = request.getServletPath();
        return !"/api/catalog/orders".equals(path) && !"/api/catalog/orders/quote".equals(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getServletPath();
        int limit = "/api/catalog/orders".equals(path) ? ORDER_LIMIT : QUOTE_LIMIT;
        String client = clientAddress(request);
        long now = System.currentTimeMillis();
        long retryAfter = consume(client + "|" + path, limit, now);
        if (retryAfter > 0) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", Long.toString(retryAfter));
            mapper.writeValue(response.getOutputStream(), new ApiError(Instant.now(), HttpStatus.TOO_MANY_REQUESTS.value(),
                    "RATE_LIMITED", "Se alcanzó el límite temporal de solicitudes. Espera antes de volver a intentar."));
            return;
        }
        chain.doFilter(request, response);
    }

    private static String clientAddress(HttpServletRequest request) {
        // The public API is only reachable through Caddy, which overwrites untrusted X-Forwarded-For values.
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String firstAddress = forwardedFor.split(",", 2)[0].trim();
            String normalizedAddress = normalizeIpAddress(firstAddress);
            if (normalizedAddress != null) return normalizedAddress;
        }
        String remoteAddress = normalizeIpAddress(request.getRemoteAddr());
        return remoteAddress == null ? "unknown" : remoteAddress;
    }

    private static String normalizeIpAddress(String value) {
        if (value == null || value.isBlank()) return null;
        String candidate = value.trim();
        boolean ipv4 = candidate.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}");
        boolean ipv6 = candidate.matches("[0-9a-fA-F:.]+") && candidate.contains(":");
        if (!ipv4 && !ipv6) return null;
        try {
            return InetAddress.getByName(candidate).getHostAddress();
        } catch (UnknownHostException ignored) {
            return null;
        }
    }

    private synchronized long consume(String key, int limit, long now) {
        Window window = windows.get(key);
        if (window == null || now - window.startedAt >= WINDOW_MILLIS) {
            if (window == null && windows.size() >= MAX_BUCKETS) {
                prune(now);
                if (windows.size() >= MAX_BUCKETS) return WINDOW_MILLIS / 1000;
            }
            window = new Window(now);
            windows.put(key, window);
        }
        if (window.count >= limit) return Math.max(1, (window.startedAt + WINDOW_MILLIS - now + 999) / 1000);
        window.count++;
        if (++checkedRequests % 256 == 0 || windows.size() > MAX_BUCKETS) prune(now);
        return 0;
    }

    private void prune(long now) {
        Iterator<Window> iterator = windows.values().iterator();
        while (iterator.hasNext()) {
            if (now - iterator.next().startedAt >= WINDOW_MILLIS) iterator.remove();
        }
    }

    private static final class Window {
        private final long startedAt;
        private int count;
        private Window(long startedAt) { this.startedAt = startedAt; }
    }
}
