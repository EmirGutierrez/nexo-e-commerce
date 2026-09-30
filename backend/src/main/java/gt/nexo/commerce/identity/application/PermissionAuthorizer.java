package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.util.Locale;
import java.time.Instant;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component("permissionAuthorizer")
public class PermissionAuthorizer {
    private final AppUserRepository users;

    public PermissionAuthorizer(AppUserRepository users) { this.users = users; }

    @Transactional(readOnly = true)
    public boolean has(Authentication authentication, String module, String action) {
        if (authentication == null || !authentication.isAuthenticated()) return false;
        String email = authentication.getName().trim().toLowerCase(Locale.ROOT);
        return users.findByEmailIgnoreCase(email)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE && !user.isCurrentlyLocked(Instant.now()))
                .map(user -> user.getRole().getPermissions().stream().anyMatch(permission ->
                        permission.getId().getModuleCode().equals(module)
                                && permission.getId().getActionCode().equals(action)))
                .orElse(false);
    }
}
