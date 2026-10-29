package gt.nexo.commerce.shared.security;

import gt.nexo.commerce.identity.application.MfaService;
import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import gt.nexo.commerce.identity.application.MobileTokenAuthenticationDetails;
import gt.nexo.commerce.shared.errors.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

/** Restricts staff sessions to MFA enrollment until a second factor is active. */
final class MfaEnrollmentEnforcementFilter extends OncePerRequestFilter {
    private final ObjectMapper mapper;
    private final MfaService mfaService;

    MfaEnrollmentEnforcementFilter(ObjectMapper mapper, MfaService mfaService) {
        this.mapper = mapper;
        this.mfaService = mfaService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (request.getServletPath().startsWith("/api/")
                && authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof NexoUserPrincipal principal) {
            MfaService.MfaAccessState access = mfaService.accessState(principal.getId());
            if (access.enrollmentRequired() && !isAllowedUntilEnrollment(request)) {
                writeError(response, HttpStatus.FORBIDDEN, "MFA_ENROLLMENT_REQUIRED",
                        "Activa la verificación en dos pasos para acceder a los módulos de NEXO.");
                return;
            }
            if (access.enabled() && !isVerified(request, authentication, principal)
                    && !isAllowedUntilReauthentication(request)) {
                writeError(response, HttpStatus.UNAUTHORIZED, "MFA_REAUTHENTICATION_REQUIRED",
                        "Vuelve a iniciar sesión y confirma tu segundo factor para continuar.");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private void writeError(HttpServletResponse response, HttpStatus status, String code, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Cache-Control", "no-store");
        mapper.writeValue(response.getOutputStream(), new ApiError(Instant.now(), status.value(), code, message));
    }

    private boolean isVerified(HttpServletRequest request, Authentication authentication, NexoUserPrincipal principal) {
        if (request.getServletPath().startsWith("/api/mobile/")) {
            if (!(authentication.getDetails() instanceof MobileTokenAuthenticationDetails details)) return false;
            return mfaService.isMobileTokenVerified(principal.getId(), details.tokenHash());
        }
        return MfaSessionVerification.isVerified(request.getSession(false), principal.getId());
    }

    private static boolean isAllowedUntilEnrollment(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getServletPath();

        if ("GET".equals(method) && ("/api/auth/csrf".equals(path)
                || "/api/auth/me".equals(path) || "/api/auth/mfa".equals(path))) return true;
        if ("POST".equals(method) && ("/api/auth/login".equals(path)
                || "/api/mobile/auth/login".equals(path)
                || "/api/auth/register".equals(path) || "/api/auth/accept-invitation".equals(path)
                || "/api/auth/logout".equals(path)
                || "/api/auth/password-reset/request".equals(path)
                || "/api/auth/password-reset/complete".equals(path)
                || "/api/auth/mfa/enroll/start".equals(path)
                || "/api/auth/mfa/enroll/complete".equals(path))) return true;

        if ("POST".equals(method) && "/api/mobile/auth/logout".equals(path)) return true;

        return isPublicStoreRequest(method, path);
    }

    private static boolean isAllowedUntilReauthentication(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getServletPath();
        return "GET".equals(method) && "/api/auth/csrf".equals(path)
                || "POST".equals(method) && ("/api/auth/login".equals(path)
                    || "/api/auth/logout".equals(path)
                    || "/api/mobile/auth/login".equals(path)
                    || "/api/mobile/auth/logout".equals(path))
                || isPublicStoreRequest(method, path);
    }

    private static boolean isPublicStoreRequest(String method, String path) {
        return "GET".equals(method) && ("/api/catalog/products".equals(path)
                    || path.startsWith("/api/catalog/products/")
                    || "/api/catalog/payment-methods".equals(path)
                    || "/api/catalog/promotions".equals(path)
                    || path.startsWith("/api/catalog/orders/submissions/"))
                || "POST".equals(method) && ("/api/catalog/orders".equals(path)
                    || "/api/catalog/orders/quote".equals(path)
                    || "/api/catalog/discounts/validate".equals(path));
    }
}
