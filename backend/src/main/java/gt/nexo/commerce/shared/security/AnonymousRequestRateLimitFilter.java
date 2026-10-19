package gt.nexo.commerce.shared.security;

import gt.nexo.commerce.shared.errors.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/** Bounds anonymous requests to expensive authentication and checkout operations. */
final class AnonymousRequestRateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_MILLIS = 10 * 60 * 1000L;
    private static final int MAX_BUCKETS = 20_000;
    private static final Map<String, Policy> POLICIES = Map.ofEntries(
            Map.entry("/api/auth/login", new Policy("authentication", 10)),
            Map.entry("/api/mobile/auth/login", new Policy("authentication", 10)),
            Map.entry("/api/auth/register", new Policy("registration", 8)),
            Map.entry("/api/auth/accept-invitation", new Policy("invitation", 10)),
            Map.entry("/api/catalog/orders", new Policy("orders", 12)),
            Map.entry("/api/catalog/orders/quote", new Policy("order-quote", 80)),
            Map.entry("/api/catalog/discounts/validate", new Policy("discount-validation", 60)));

    private final ObjectMapper mapper;
    private final Map<String, Window> windows = new HashMap<>();
    private long checkedRequests;

    AnonymousRequestRateLimitFilter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !POLICIES.containsKey(request.getServletPath());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Policy policy = POLICIES.get(request.getServletPath());
        String client = clientAddress(request);
        long now = System.currentTimeMillis();
        long retryAfter = consume(client + "|" + policy.bucket(), policy.limit(), now);
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
        // Caddy is the only public entry point and ignores client-supplied forwarding headers by default.
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
        if (ipv4) {
            for (String part : candidate.split("\\.")) {
                if (Integer.parseInt(part) > 255) return null;
            }
        }
        try {
            InetAddress address = InetAddress.getByName(candidate);
            if (address instanceof Inet6Address) {
                byte[] prefix = address.getAddress();
                Arrays.fill(prefix, 8, prefix.length, (byte) 0);
                return InetAddress.getByAddress(prefix).getHostAddress() + "/64";
            }
            return address.getHostAddress();
        } catch (UnknownHostException ignored) {
            return null;
        }
    }

    private synchronized long consume(String key, int limit, long now) {
        Window window = windows.get(key);
        if (window == null || now - window.startedAt() >= WINDOW_MILLIS) {
            if (window == null && windows.size() >= MAX_BUCKETS) {
                prune(now);
                if (windows.size() >= MAX_BUCKETS) return WINDOW_MILLIS / 1000;
            }
            window = new Window(now, 0);
            windows.put(key, window);
        }
        if (window.count() >= limit) return Math.max(1, (window.startedAt() + WINDOW_MILLIS - now + 999) / 1000);
        windows.put(key, new Window(window.startedAt(), window.count() + 1));
        if (++checkedRequests % 256 == 0 || windows.size() > MAX_BUCKETS) prune(now);
        return 0;
    }

    private void prune(long now) {
        Iterator<Window> iterator = windows.values().iterator();
        while (iterator.hasNext()) {
            if (now - iterator.next().startedAt() >= WINDOW_MILLIS) iterator.remove();
        }
    }

    private record Policy(String bucket, int limit) { }
    private record Window(long startedAt, int count) { }
}
