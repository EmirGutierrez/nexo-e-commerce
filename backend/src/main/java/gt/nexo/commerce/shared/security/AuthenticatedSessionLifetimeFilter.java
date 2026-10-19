package gt.nexo.commerce.shared.security;

import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import gt.nexo.commerce.shared.errors.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/** Enforces an absolute lifetime for authenticated browser sessions, in addition to idle expiry. */
public final class AuthenticatedSessionLifetimeFilter extends OncePerRequestFilter {
    public static final String AUTHENTICATED_AT_ATTRIBUTE = "nexo.authenticated-at";

    private final ObjectMapper mapper;
    private final long absoluteLifetimeMillis;

    AuthenticatedSessionLifetimeFilter(ObjectMapper mapper, Duration absoluteLifetime) {
        this.mapper = mapper;
        this.absoluteLifetimeMillis = absoluteLifetime.toMillis();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (session == null || authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof NexoUserPrincipal)) {
            chain.doFilter(request, response);
            return;
        }

        long now = System.currentTimeMillis();
        Object storedTimestamp = session.getAttribute(AUTHENTICATED_AT_ATTRIBUTE);
        long authenticatedAt = storedTimestamp instanceof Number number ? number.longValue() : now;
        if (!(storedTimestamp instanceof Number)) session.setAttribute(AUTHENTICATED_AT_ATTRIBUTE, authenticatedAt);
        if (now - authenticatedAt >= absoluteLifetimeMillis) {
            SecurityContextHolder.clearContext();
            session.invalidate();
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            mapper.writeValue(response.getOutputStream(), new ApiError(Instant.now(), HttpStatus.UNAUTHORIZED.value(),
                    "SESSION_EXPIRED", "La sesión superó el tiempo máximo. Inicia sesión nuevamente."));
            return;
        }
        chain.doFilter(request, response);
    }
}
