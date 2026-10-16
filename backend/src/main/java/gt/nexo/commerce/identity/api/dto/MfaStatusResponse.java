package gt.nexo.commerce.identity.api.dto;

public record MfaStatusResponse(boolean enabled, boolean enrollmentPending, int recoveryCodesRemaining) { }
