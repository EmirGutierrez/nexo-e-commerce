package gt.nexo.commerce.identity.application;

public class MfaUnavailableException extends RuntimeException {
    public MfaUnavailableException() {
        super("La protección MFA no está configurada en el servidor.");
    }
}
