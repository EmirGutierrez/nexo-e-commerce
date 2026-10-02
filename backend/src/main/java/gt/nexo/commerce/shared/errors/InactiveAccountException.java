package gt.nexo.commerce.shared.errors;

public class InactiveAccountException extends RuntimeException {
    public InactiveAccountException() {
        super("Tu cuenta está inactiva. Contacta al administrador para solicitar que la reactive.");
    }
}
