package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.api.dto.TeamInvitationRequest;
import gt.nexo.commerce.identity.api.dto.TeamInvitationResponse;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TeamInvitationService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final AppUserRepository users;
    private final RoleRepository roles;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final PermissionAuthorizer permissions;

    public TeamInvitationService(AppUserRepository users, RoleRepository roles, JdbcTemplate jdbc,
                                 PasswordEncoder passwordEncoder, PermissionAuthorizer permissions) {
        this.users = users;
        this.roles = roles;
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.permissions = permissions;
    }

    @Transactional
    public TeamInvitationResponse invite(TeamInvitationRequest request, Authentication authentication) {
        if (!permissions.has(authentication, "users", "create")) throw new AccessDeniedException("Se requiere users:create.");
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String name = request.name().trim();
        String roleCode = request.role().trim().toLowerCase(Locale.ROOT);
        if (name.isBlank() || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw invalid("Revisa el nombre y el correo de la invitación.");
        if (roleCode.equals("customer") || roleCode.equals("superadmin")) throw invalid("El rol de la invitación no está permitido.");
        var role = roles.findById(roleCode).orElseThrow(() -> invalid("El rol solicitado no existe."));
        var existing = users.findByEmailIgnoreCase(email);
        if (existing.isPresent() && existing.get().getStatus() != UserStatus.PENDING) {
            throw new BusinessRuleException(HttpStatus.CONFLICT, "ACCOUNT_ALREADY_EXISTS", "Ya existe una cuenta activa o deshabilitada con ese correo.");
        }

        AppUserEntity account;
        if (existing.isPresent()) {
            account = existing.get();
            account.changeDisplayName(name);
            account.changeRole(role);
        } else {
            byte[] initialSecret = new byte[32];
            RANDOM.nextBytes(initialSecret);
            account = users.saveAndFlush(new AppUserEntity(UUID.randomUUID(), email, name,
                    passwordEncoder.encode(Base64.getEncoder().encodeToString(initialSecret)), role, UserStatus.PENDING));
        }
        byte[] rawToken = new byte[32];
        RANDOM.nextBytes(rawToken);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(rawToken);
        Instant expiresAt = Instant.now().plusSeconds(48 * 60 * 60L);
        UUID inviter = principalId(authentication);
        jdbc.update("""
                INSERT INTO user_invitations (user_id, token_hash, expires_at, invited_by, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash,
                expires_at = EXCLUDED.expires_at, accepted_at = NULL, invited_by = EXCLUDED.invited_by,
                created_at = CURRENT_TIMESTAMP
                """, account.getId(), hash(token), expiresAt, inviter);
        return new TeamInvitationResponse(account.getId(), email, "PENDING", token);
    }

    @Transactional
    public void accept(String token, String rawPassword) {
        if (rawPassword == null || rawPassword.length() < 12) throw invalid("La contraseña debe tener al menos 12 caracteres.");
        if (token == null || token.isBlank()) throw invalid("El enlace de invitación no es válido.");
        UUID userId = jdbc.query("""
                SELECT user_id FROM user_invitations
                WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > CURRENT_TIMESTAMP
                FOR UPDATE
                """, rs -> rs.next() ? rs.getObject(1, UUID.class) : null, hash(token));
        if (userId == null) throw new BusinessRuleException(HttpStatus.GONE, "INVITATION_EXPIRED", "La invitación ya fue usada o venció. Solicita una nueva.");
        AppUserEntity user = users.findById(userId).orElseThrow(() -> invalid("La cuenta de la invitación ya no existe."));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.changeStatus(UserStatus.ACTIVE);
        jdbc.update("UPDATE user_invitations SET accepted_at = CURRENT_TIMESTAMP WHERE user_id = ?", userId);
    }

    private static UUID principalId(Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof NexoUserPrincipal principal ? principal.getId() : null;
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static BusinessRuleException invalid(String message) {
        return new BusinessRuleException(HttpStatus.BAD_REQUEST, "INVITATION_INVALID", message);
    }
}
