package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.business.application.BusinessEmailService;
import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class PasswordRecoveryService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long TOKEN_LIFETIME_SECONDS = 30 * 60L;

    private final AppUserRepository users;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher eventPublisher;
    private final String passwordResetUrl;

    public PasswordRecoveryService(AppUserRepository users, JdbcTemplate jdbc, PasswordEncoder passwordEncoder,
                                  ApplicationEventPublisher eventPublisher,
                                  @Value("${nexo.auth.password-reset-url:http://localhost:3000/reset-password}")
                                  String passwordResetUrl) {
        this.users = users;
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.eventPublisher = eventPublisher;
        this.passwordResetUrl = passwordResetUrl;
    }

    @Transactional
    public void requestReset(String emailAddress) {
        String email = emailAddress.trim().toLowerCase(Locale.ROOT);
        var account = users.findByEmailIgnoreCase(email)
                .filter(user -> user.getStatus() != UserStatus.PENDING)
                .orElse(null);
        if (account == null) return;

        byte[] randomToken = new byte[32];
        RANDOM.nextBytes(randomToken);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(randomToken);
        String tokenHash = hash(token);
        OffsetDateTime expiresAt = OffsetDateTime.ofInstant(
                Instant.now().plusSeconds(TOKEN_LIFETIME_SECONDS), ZoneOffset.UTC);
        int issued = jdbc.update("""
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash,
                    expires_at = EXCLUDED.expires_at, created_at = CURRENT_TIMESTAMP
                WHERE password_reset_tokens.created_at <= CURRENT_TIMESTAMP - INTERVAL '1 minute'
                """, account.getId(), tokenHash, expiresAt);
        if (issued != 1) return;

        String link = UriComponentsBuilder.fromUriString(passwordResetUrl)
                .queryParam("token", token).build().encode().toUriString();
        String message = "Hola " + account.getDisplayName() + ",\n\n"
                + "Recibimos una solicitud para restablecer la contraseña de tu cuenta de NEXO Commerce.\n"
                + "Abre este enlace en los próximos 30 minutos para elegir una nueva contraseña:\n"
                + link + "\n\n"
                + "El enlace se puede usar una sola vez. Si no solicitaste este cambio, ignora este correo; "
                + "tu contraseña actual seguirá funcionando.";
        eventPublisher.publishEvent(new BusinessEmailService.EmailRequested(
                account.getEmail(), "Restablece tu contraseña de NEXO Commerce", message));
    }

    @Transactional
    public void completeReset(String token, String newPassword) {
        if (!PasswordPolicy.isWithinBcryptLimit(newPassword)) {
            throw new BusinessRuleException(HttpStatus.BAD_REQUEST, "PASSWORD_TOO_LONG",
                    "La contraseña no puede superar 72 bytes UTF-8 por el algoritmo de almacenamiento seguro.");
        }
        String tokenHash = hash(token);
        UUID userId;
        try {
            userId = jdbc.queryForObject("""
                    SELECT reset.user_id
                    FROM password_reset_tokens reset
                    JOIN app_user account ON account.id = reset.user_id
                    WHERE reset.token_hash = ? AND reset.expires_at > CURRENT_TIMESTAMP
                      AND account.status <> 'PENDING'
                    FOR UPDATE OF reset
                    """, UUID.class, tokenHash);
        } catch (EmptyResultDataAccessException exception) {
            throw invalidOrExpired();
        }
        var account = users.findByIdForPasswordChange(userId)
                .filter(user -> user.getStatus() != UserStatus.PENDING)
                .orElseThrow(PasswordRecoveryService::invalidOrExpired);

        account.setPasswordHash(passwordEncoder.encode(newPassword));
        jdbc.update("DELETE FROM password_reset_tokens WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM SPRING_SESSION WHERE LOWER(PRINCIPAL_NAME) = LOWER(?)", account.getEmail());
        jdbc.update("DELETE FROM mobile_access_token WHERE user_id = ?", userId);
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static BusinessRuleException invalidOrExpired() {
        return new BusinessRuleException(HttpStatus.GONE, "PASSWORD_RESET_INVALID",
                "El enlace para restablecer la contraseña ya fue usado o venció. Solicita uno nuevo.");
    }
}
