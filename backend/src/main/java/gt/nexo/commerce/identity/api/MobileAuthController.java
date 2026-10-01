package gt.nexo.commerce.identity.api;

import gt.nexo.commerce.identity.api.dto.LoginRequest;
import gt.nexo.commerce.identity.api.dto.MobileLoginResponse;
import gt.nexo.commerce.identity.api.dto.UserResponse;
import gt.nexo.commerce.identity.application.MobileAuthenticationService;
import gt.nexo.commerce.identity.application.MobileSessionService;
import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import gt.nexo.commerce.identity.application.UserAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mobile/auth")
public class MobileAuthController {
    private final MobileAuthenticationService authenticationService;
    private final MobileSessionService mobileSessionService;
    private final UserAccountService userAccountService;

    public MobileAuthController(MobileAuthenticationService authenticationService,
                                MobileSessionService mobileSessionService,
                                UserAccountService userAccountService) {
        this.authenticationService = authenticationService;
        this.mobileSessionService = mobileSessionService;
        this.userAccountService = userAccountService;
    }

    @PostMapping("/login")
    @Operation(summary = "Inicia una sesión móvil y devuelve un token opaco de duración limitada.")
    public MobileLoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authenticationService.login(request);
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Devuelve la cuenta móvil autenticada y sus permisos vigentes.")
    public UserResponse me(Authentication authentication) {
        NexoUserPrincipal principal = (NexoUserPrincipal) authentication.getPrincipal();
        return userAccountService.currentUser(principal.getId());
    }

    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Revoca el token móvil actual.")
    public ResponseEntity<Void> logout(Authentication authentication) {
        mobileSessionService.revoke(authentication);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
