package gt.nexo.commerce.identity.api.dto;

import java.util.List;

public record MfaRecoveryCodesResponse(List<String> recoveryCodes) { }
