package gt.nexo.commerce.shared.errors;

public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() {
        super("Correo o contraseña incorrectos.");
    }
}
