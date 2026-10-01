package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.PermissionEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.PermissionId;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

class PermissionAuthorizerTest {
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final PermissionAuthorizer authorizer = new PermissionAuthorizer(users);
    private final AppUserEntity user = mock(AppUserEntity.class);
    private final RoleEntity role = mock(RoleEntity.class);
    private final PermissionEntity viewUsers = mock(PermissionEntity.class);
    private final Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
            "staff@nexo.gt", "ignored", java.util.List.of());

    @BeforeEach
    void setUp() {
        when(users.findByEmailIgnoreCase("staff@nexo.gt")).thenReturn(Optional.of(user));
        when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(user.getRole()).thenReturn(role);
        when(role.getPermissions()).thenReturn(Set.of(viewUsers));
        when(viewUsers.getId()).thenReturn(new PermissionId("users", "view"));
    }

    @Test
    void grantsOnlyAnExplicitPermissionFromTheCurrentRole() {
        assertTrue(authorizer.has(authentication, "users", "view"));
        assertFalse(authorizer.has(authentication, "users", "delete"));
        assertFalse(authorizer.has(authentication, "products", "view"));
    }

    @Test
    void deniesInactiveAccountsAndUnauthenticatedRequests() {
        when(user.getStatus()).thenReturn(UserStatus.DISABLED);
        assertFalse(authorizer.has(authentication, "users", "view"));

        Authentication anonymous = UsernamePasswordAuthenticationToken.unauthenticated("anonymous", "");
        assertFalse(authorizer.has(anonymous, "users", "view"));
        assertFalse(authorizer.has(null, "users", "view"));
    }
}
