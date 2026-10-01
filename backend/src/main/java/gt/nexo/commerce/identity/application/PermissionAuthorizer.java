package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.util.Locale;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

@Component("permissionAuthorizer")
public class PermissionAuthorizer {
    private final AppUserRepository users;
    private final JdbcTemplate jdbc;

    public PermissionAuthorizer(AppUserRepository users) { this(users, null); }
    @Autowired
    public PermissionAuthorizer(AppUserRepository users, JdbcTemplate jdbc) { this.users = users; this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public boolean has(Authentication authentication, String module, String action) {
        if (authentication == null || !authentication.isAuthenticated()) return false;
        String email = authentication.getName().trim().toLowerCase(Locale.ROOT);
        return users.findByEmailIgnoreCase(email)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE && !user.isCurrentlyLocked(Instant.now()))
                .map(user -> {
                    if (jdbc == null) return user.getRole().getPermissions().stream().anyMatch(permission ->
                            permission.getId().getModuleCode().equals(module)
                                    && permission.getId().getActionCode().equals(action));
                    var override = jdbc.query("""
                            SELECT granted FROM user_permissions WHERE user_id = ? AND module_code = ? AND action_code = ?
                            """, rs -> rs.next() ? java.util.Optional.of(rs.getBoolean(1)) : java.util.Optional.<Boolean>empty(),
                            user.getId(), module, action);
                    return override.orElseGet(() -> user.getRole().getPermissions().stream().anyMatch(permission ->
                            permission.getId().getModuleCode().equals(module)
                                    && permission.getId().getActionCode().equals(action)));
                })
                .orElse(false);
    }
}
