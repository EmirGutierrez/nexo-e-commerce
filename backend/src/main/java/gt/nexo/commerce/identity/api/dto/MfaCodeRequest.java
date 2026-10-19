package gt.nexo.commerce.identity.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MfaCodeRequest(@NotBlank @Size(max = 32) String code) { }
