package gt.nexo.commerce.identity.api.dto;

public record MfaStatusResponse(boolean required, boolean enabled, boolean enrollmentPending,
                                int recoveryCodesRemaining) {
    public MfaStatusResponse(boolean enabled, boolean enrollmentPending, int recoveryCodesRemaining) {
        this(false, enabled, enrollmentPending, recoveryCodesRemaining);
    }
}
