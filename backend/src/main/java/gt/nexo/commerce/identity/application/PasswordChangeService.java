package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.api.dto.PasswordChangeRequest;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import gt.nexo.commerce.shared.errors.InvalidCredentialsException;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordChangeService {
    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final MfaService mfaService;
    private final JdbcTemplate jdbc;

    public PasswordChangeService(AppUserRepository users, PasswordEncoder passwordEncoder,
                                 MfaService mfaService, JdbcTemplate jdbc) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.mfaService = mfaService;
        this.jdbc = jdbc;
    }

    @Transactional
    public void change(UUID userId, PasswordChangeRequest request) {
        var account = users.findByIdForPasswordChange(userId)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE && !user.isCurrentlyLocked(Instant.now()))
                .orElseThrow(InvalidCredentialsException::new);
        String passwordHash = account.getPasswordHash();

        if (!passwordEncoder.matches(request.currentPassword(), passwordHash)) {
            throw new InvalidCredentialsException();
        }
        if (!PasswordPolicy.isWithinBcryptLimit(request.newPassword())) {
            throw new BusinessRuleException(HttpStatus.BAD_REQUEST, "PASSWORD_TOO_LONG",
                    "La contraseña no puede superar 72 bytes UTF-8 por el algoritmo de almacenamiento seguro.");
        }
        if (passwordEncoder.matches(request.newPassword(), passwordHash)) {
            throw new BusinessRuleException(HttpStatus.BAD_REQUEST, "PASSWORD_UNCHANGED",
                    "La nueva contraseña debe ser distinta de la actual.");
        }

        // Si MFA está activa, consume un TOTP vigente o un código de recuperación en esta transacción.
        mfaService.verifyLogin(userId, request.mfaCode());
        account.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        jdbc.update("DELETE FROM SPRING_SESSION WHERE LOWER(PRINCIPAL_NAME) = LOWER(?)", account.getEmail());
        jdbc.update("DELETE FROM mobile_access_token WHERE user_id = ?", userId);
    }
}
