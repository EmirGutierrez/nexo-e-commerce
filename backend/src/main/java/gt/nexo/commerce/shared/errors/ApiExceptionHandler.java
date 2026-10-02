package gt.nexo.commerce.shared.errors;

import gt.nexo.commerce.business.application.BusinessRuleException;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.dao.DataIntegrityViolationException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(AccountAlreadyExistsException.class)
    ResponseEntity<ApiError> accountAlreadyExists(AccountAlreadyExistsException exception) {
        return error(HttpStatus.CONFLICT, "ACCOUNT_ALREADY_EXISTS", exception.getMessage());
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    ResponseEntity<ApiError> invalidCredentials(InvalidCredentialsException exception) {
        return error(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", exception.getMessage());
    }

    @ExceptionHandler(InactiveAccountException.class)
    ResponseEntity<ApiError> inactiveAccount(InactiveAccountException exception) {
        return error(HttpStatus.FORBIDDEN, "ACCOUNT_INACTIVE", exception.getMessage());
    }

    @ExceptionHandler(BusinessRuleException.class)
    ResponseEntity<ApiError> businessRule(BusinessRuleException exception) {
        return error(exception.getStatus(), exception.getCode(), exception.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> persistenceConflict(DataIntegrityViolationException exception) {
        return error(HttpStatus.CONFLICT, "PERSISTENCE_CONFLICT", "La operación entra en conflicto con datos relacionados o una restricción del negocio.");
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class})
    ResponseEntity<ApiError> invalidInput(Exception exception) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Revisa los datos enviados.");
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> forbidden(AccessDeniedException exception) {
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", "No tienes permiso para realizar esta operación.");
    }

    @ExceptionHandler(UsernameNotFoundException.class)
    ResponseEntity<ApiError> accountUnavailable(UsernameNotFoundException exception) {
        return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "La cuenta autenticada no está disponible.");
    }

    private ResponseEntity<ApiError> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiError(Instant.now(), status.value(), code, message));
    }
}
