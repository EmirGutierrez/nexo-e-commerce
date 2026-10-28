package gt.nexo.commerce.identity.api;

import gt.nexo.commerce.identity.api.dto.PasswordResetCompleteRequest;
import gt.nexo.commerce.identity.api.dto.PasswordResetRequest;
import gt.nexo.commerce.identity.application.PasswordRecoveryService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/password-reset")
public class PasswordRecoveryController {
    private final PasswordRecoveryService passwordRecoveryService;

    public PasswordRecoveryController(PasswordRecoveryService passwordRecoveryService) {
        this.passwordRecoveryService = passwordRecoveryService;
    }

    @PostMapping("/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Solicita por correo un enlace temporal para restablecer la contraseña.")
    public void request(@Valid @RequestBody PasswordResetRequest request) {
        passwordRecoveryService.requestReset(request.email());
    }

    @PostMapping("/complete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Establece una nueva contraseña con un enlace temporal de un solo uso.")
    public void complete(@Valid @RequestBody PasswordResetCompleteRequest request) {
        passwordRecoveryService.completeReset(request.token(), request.newPassword());
    }
}
