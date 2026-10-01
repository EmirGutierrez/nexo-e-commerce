package gt.nexo.commerce.identity.api;

import gt.nexo.commerce.identity.api.dto.CsrfTokenResponse;
import gt.nexo.commerce.identity.api.dto.LoginRequest;
import gt.nexo.commerce.identity.api.dto.UserResponse;
import gt.nexo.commerce.identity.application.AuthenticationService;
import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import gt.nexo.commerce.identity.application.UserAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationService authenticationService;
    private final UserAccountService userAccountService;
    private final SecurityContextLogoutHandler logoutHandler;

    public AuthController(AuthenticationService authenticationService,
                          UserAccountService userAccountService,
                          SecurityContextLogoutHandler logoutHandler) {
        this.authenticationService = authenticationService;
        this.userAccountService = userAccountService;
        this.logoutHandler = logoutHandler;
    }

    @GetMapping("/csrf")
    @Operation(summary = "Obtiene un token CSRF para solicitudes que modifican el estado.")
    public CsrfTokenResponse csrf(HttpServletRequest request) {
        CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (token == null) token = (CsrfToken) request.getAttribute("_csrf");
        return new CsrfTokenResponse(token == null ? "" : token.getToken());
    }

    @PostMapping("/login")
    @Operation(summary = "Inicia sesión administrativa y crea una sesión del servidor.")
    public UserResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest servletRequest,
                              HttpServletResponse servletResponse) {
        return authenticationService.login(request, servletRequest, servletResponse);
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "sessionCookie")
    @Operation(summary = "Devuelve la cuenta autenticada y sus permisos vigentes.")
    public UserResponse me(Authentication authentication) {
        NexoUserPrincipal principal = (NexoUserPrincipal) authentication.getPrincipal();
        return userAccountService.currentUser(principal.getId());
    }

    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "sessionCookie")
    @Operation(summary = "Cierra la sesión administrativa del servidor.")
    public ResponseEntity<Void> logout(Authentication authentication,
                                       HttpServletRequest request,
                                       HttpServletResponse response) {
        logoutHandler.logout(request, response, authentication);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
