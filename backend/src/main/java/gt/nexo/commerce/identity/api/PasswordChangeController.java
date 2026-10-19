package gt.nexo.commerce.identity.api;

import gt.nexo.commerce.identity.api.dto.PasswordChangeRequest;
import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import gt.nexo.commerce.identity.application.PasswordChangeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/me/password")
public class PasswordChangeController {
    private final PasswordChangeService passwordChangeService;
    private final SecurityContextLogoutHandler logoutHandler;

    public PasswordChangeController(PasswordChangeService passwordChangeService,
                                    SecurityContextLogoutHandler logoutHandler) {
        this.passwordChangeService = passwordChangeService;
        this.logoutHandler = logoutHandler;
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "sessionCookie")
    @Operation(summary = "Cambia la contraseña autenticada y cierra todas las sesiones de la cuenta.")
    public ResponseEntity<Void> changePassword(Authentication authentication,
                                               @Valid @RequestBody PasswordChangeRequest request,
                                               HttpServletRequest servletRequest,
                                               HttpServletResponse servletResponse) {
        NexoUserPrincipal principal = (NexoUserPrincipal) authentication.getPrincipal();
        passwordChangeService.change(principal.getId(), request);
        logoutHandler.logout(servletRequest, servletResponse, authentication);
        return ResponseEntity.noContent().build();
    }
}
