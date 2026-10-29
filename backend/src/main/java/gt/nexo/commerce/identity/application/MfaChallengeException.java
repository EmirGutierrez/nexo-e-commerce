package gt.nexo.commerce.identity.application;

public class MfaChallengeException extends RuntimeException {
    private final String code;

    public MfaChallengeException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() { return code; }

    public static MfaChallengeException required() {
        return new MfaChallengeException("MFA_REQUIRED", "Ingresa el código de autenticación o un código de recuperación.");
    }

    public static MfaChallengeException invalid() {
        return new MfaChallengeException("MFA_INVALID", "El código de autenticación no es válido o ya fue utilizado.");
    }

    public static MfaChallengeException enrollmentRequired() {
        return new MfaChallengeException("MFA_ENROLLMENT_REQUIRED",
                "Esta cuenta de equipo debe activar la verificación en dos pasos desde el acceso web antes de usar la aplicación móvil.");
    }
}
