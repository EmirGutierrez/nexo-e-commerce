package gt.nexo.commerce.identity.api;

import gt.nexo.commerce.identity.api.dto.CsrfTokenResponse;
import gt.nexo.commerce.identity.api.dto.LoginRequest;
import gt.nexo.commerce.identity.api.dto.RegisterRequest;
import gt.nexo.commerce.identity.api.dto.UserResponse;
import gt.nexo.commerce.identity.api.dto.TeamInvitationRequest;
import gt.nexo.commerce.identity.api.dto.TeamInvitationResponse;
import gt.nexo.commerce.identity.api.dto.AcceptInvitationRequest;
import gt.nexo.commerce.identity.application.TeamInvitationService;
import gt.nexo.commerce.identity.application.AuthenticationService;
import gt.nexo.commerce.identity.application.CustomerRegistrationService;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationService authenticationService;
    private final UserAccountService userAccountService;
    private final CustomerRegistrationService customerRegistrationService;
    private final SecurityContextLogoutHandler logoutHandler;
    private final TeamInvitationService teamInvitationService;

    public AuthController(AuthenticationService authenticationService,
                          UserAccountService userAccountService,
                          CustomerRegistrationService customerRegistrationService,
                          SecurityContextLogoutHandler logoutHandler,
                          TeamInvitationService teamInvitationService) {
        this.authenticationService = authenticationService;
        this.userAccountService = userAccountService;
        this.customerRegistrationService = customerRegistrationService;
        this.logoutHandler = logoutHandler;
        this.teamInvitationService = teamInvitationService;
    }

    @GetMapping("/csrf")
    @Operation(summary = "Obtiene un token CSRF para solicitudes que modifican el estado.")
    public CsrfTokenResponse csrf(HttpServletRequest request) {
        CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        if (token == null) token = (CsrfToken) request.getAttribute("_csrf");
        return new CsrfTokenResponse(token == null ? "" : token.getToken());
    }

    @PostMapping("/login")
    @Operation(summary = "Inicia sesión y crea una sesión del servidor.")
    public UserResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest servletRequest,
                              HttpServletResponse servletResponse) {
        return authenticationService.login(request, servletRequest, servletResponse);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Registra una cuenta de cliente e inicia sesión.")
    public UserResponse register(@Valid @RequestBody RegisterRequest request,
                                 HttpServletRequest servletRequest,
                                 HttpServletResponse servletResponse) {
        customerRegistrationService.register(request);
        return authenticationService.login(new LoginRequest(request.email(), request.password()),
                servletRequest, servletResponse);
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
    @Operation(summary = "Cierra la sesión del servidor.")
    public ResponseEntity<Void> logout(Authentication authentication,
                                       HttpServletRequest request,
                                       HttpServletResponse response) {
        logoutHandler.logout(request, response, authentication);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PatchMapping("/me/profile")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "sessionCookie")
    @Operation(summary = "Actualiza el nombre visible de la cuenta autenticada.")
    public UserResponse updateProfile(Authentication authentication, @RequestBody java.util.Map<String, String> request) {
        NexoUserPrincipal principal = (NexoUserPrincipal) authentication.getPrincipal();
        return userAccountService.updateOwnProfile(principal.getId(), request.get("name"));
    }

    @PostMapping("/accept-invitation")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Canjea una invitación de equipo y establece la contraseña de la cuenta.")
    public void acceptInvitation(@Valid @RequestBody AcceptInvitationRequest request) {
        teamInvitationService.accept(request.token(), request.password());
    }
}
