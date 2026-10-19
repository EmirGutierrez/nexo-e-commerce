package gt.nexo.commerce.identity.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MfaDisableRequest(
        @NotBlank @Size(max = 128) String currentPassword,
        @NotBlank @Size(max = 32) String code) { }
