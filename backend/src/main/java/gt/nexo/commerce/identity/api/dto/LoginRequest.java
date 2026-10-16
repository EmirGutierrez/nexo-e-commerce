package gt.nexo.commerce.identity.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Credenciales de una cuenta de cliente o personal.")
public record LoginRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(max = 128) String password,
        @Size(max = 32) String mfaCode) {
    public LoginRequest(String email, String password) {
        this(email, password, null);
    }
}
