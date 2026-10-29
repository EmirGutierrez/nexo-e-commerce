package gt.nexo.commerce.shared.security;

import gt.nexo.commerce.identity.application.MobileSessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.web.filter.OncePerRequestFilter;

final class MobileBearerTokenFilter extends OncePerRequestFilter {
    private static final String BEARER_PREFIX = "Bearer ";

    private final MobileSessionService mobileSessionService;
    private final AuthenticationEntryPoint authenticationEntryPoint;

    MobileBearerTokenFilter(MobileSessionService mobileSessionService,
                            AuthenticationEntryPoint authenticationEntryPoint) {
        this.mobileSessionService = mobileSessionService;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            String rawToken = authorization.substring(BEARER_PREFIX.length()).trim();
            Optional<Authentication> authentication = mobileSessionService.authenticate(rawToken);
            if (authentication.isEmpty()) {
                SecurityContextHolder.clearContext();
                authenticationEntryPoint.commence(request, response,
                        new BadCredentialsException("The mobile access token is invalid or expired."));
                return;
            }
            var mobileContext = SecurityContextHolder.createEmptyContext();
            mobileContext.setAuthentication(authentication.get());
            SecurityContextHolder.setContext(mobileContext);
        }

        filterChain.doFilter(request, response);
    }
}
