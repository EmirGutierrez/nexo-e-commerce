package gt.nexo.commerce.shared.errors;

public class AccountAlreadyExistsException extends RuntimeException {
    public AccountAlreadyExistsException() {
        super("Ya existe una cuenta con ese correo.");
    }
}
