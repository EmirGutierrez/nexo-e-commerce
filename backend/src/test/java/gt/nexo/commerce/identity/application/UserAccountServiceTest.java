package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class UserAccountServiceTest {
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final RoleRepository roles = mock(RoleRepository.class);
    private final PermissionAuthorizer authorizer = mock(PermissionAuthorizer.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UserAccountService service = new UserAccountService(users, roles, authorizer, jdbc);
    private final UUID userId = UUID.randomUUID();
    private final AppUserEntity user = mock(AppUserEntity.class);
    private final RoleEntity targetRole = mock(RoleEntity.class);
    private Authentication owner;

    @BeforeEach
    void setUp() {
        owner = UsernamePasswordAuthenticationToken.authenticated("owner@nexo.gt", "ignored",
                List.of(new SimpleGrantedAuthority("ROLE_SUPERADMIN")));
        when(authorizer.has(owner, "users", "delete")).thenReturn(true);
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(user.getEmail()).thenReturn("staff@nexo.gt");
        when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(user.getRole()).thenReturn(targetRole);
        when(targetRole.getCode()).thenReturn("admin");
    }

    @Test
    void removesTeamUserAndClosesEveryPersistedSession() {
        when(targetRole.getCode()).thenReturn("admin");

        service.deleteTeamUser(userId, owner);

        verify(jdbc).update(contains("DELETE FROM SPRING_SESSION"), eq("staff@nexo.gt"));
        verify(users).delete(user);
    }

    @Test
    void preventsDeletingTheCurrentAccount() {
        Authentication self = UsernamePasswordAuthenticationToken.authenticated("staff@nexo.gt", "ignored", List.of());
        when(authorizer.has(self, "users", "delete")).thenReturn(true);

        BusinessRuleException exception = assertThrows(BusinessRuleException.class,
                () -> service.deleteTeamUser(userId, self));

        assertEquals("CANNOT_DELETE_SELF", exception.getCode());
        verify(jdbc, never()).update(contains("SPRING_SESSION"), eq("staff@nexo.gt"));
        verify(users, never()).delete(user);
    }

    @Test
    void protectsTheLastSuperAdministrator() {
        when(targetRole.getCode()).thenReturn("superadmin");
        when(jdbc.queryForObject(contains("FOR UPDATE"), eq(String.class))).thenReturn("superadmin");
        when(users.countByRole_CodeAndStatus("superadmin", UserStatus.ACTIVE)).thenReturn(1L);

        BusinessRuleException exception = assertThrows(BusinessRuleException.class,
                () -> service.deleteTeamUser(userId, owner));

        assertEquals("LAST_SUPERADMIN", exception.getCode());
        verify(users, never()).delete(user);
    }

    @Test
    void allowsDeletingAnInactiveSuperAdministratorWhenAnActiveOneRemains() {
        when(targetRole.getCode()).thenReturn("superadmin");
        when(user.getStatus()).thenReturn(UserStatus.DISABLED);
        when(jdbc.queryForObject(contains("FOR UPDATE"), eq(String.class))).thenReturn("superadmin");

        service.deleteTeamUser(userId, owner);

        verify(users).delete(user);
        verify(users, never()).countByRole_CodeAndStatus("superadmin", UserStatus.ACTIVE);
    }

    @Test
    void protectsTheLastActiveSuperAdministratorFromDeactivation() {
        when(targetRole.getCode()).thenReturn("superadmin");
        when(jdbc.queryForObject(contains("FOR UPDATE"), eq(String.class))).thenReturn("superadmin");
        when(users.countByRole_CodeAndStatus("superadmin", UserStatus.ACTIVE)).thenReturn(1L);
        when(authorizer.has(owner, "users", "edit")).thenReturn(true);

        BusinessRuleException exception = assertThrows(BusinessRuleException.class,
                () -> service.updateStatus(userId, "DISABLED", owner));

        assertEquals("LAST_SUPERADMIN", exception.getCode());
        verify(user, never()).changeStatus(UserStatus.DISABLED);
    }

    @Test
    void protectsTheLastActiveSuperAdministratorFromRoleRemoval() {
        when(targetRole.getCode()).thenReturn("superadmin");
        when(jdbc.queryForObject(contains("FOR UPDATE"), eq(String.class))).thenReturn("superadmin");
        when(users.countByRole_CodeAndStatus("superadmin", UserStatus.ACTIVE)).thenReturn(1L);
        when(authorizer.has(owner, "users", "edit")).thenReturn(true);

        BusinessRuleException exception = assertThrows(BusinessRuleException.class,
                () -> service.updateRole(userId, "admin", owner));

        assertEquals("LAST_SUPERADMIN", exception.getCode());
        verify(user, never()).changeRole(any(RoleEntity.class));
    }

    @Test
    void onlySuperAdministratorsCanRemoveAnotherSuperAdministrator() {
        when(targetRole.getCode()).thenReturn("superadmin");
        Authentication administrator = UsernamePasswordAuthenticationToken.authenticated("owner@nexo.gt", "ignored", List.of());
        when(authorizer.has(administrator, "users", "delete")).thenReturn(true);

        assertThrows(AccessDeniedException.class, () -> service.deleteTeamUser(userId, administrator));

        verify(jdbc, never()).queryForObject(contains("FOR UPDATE"), eq(String.class));
        verify(users, never()).delete(user);
    }

    @Test
    void requiresRevokingPendingInvitationsThroughTheirDedicatedFlow() {
        when(targetRole.getCode()).thenReturn("admin");
        when(user.getStatus()).thenReturn(UserStatus.PENDING);

        BusinessRuleException exception = assertThrows(BusinessRuleException.class,
                () -> service.deleteTeamUser(userId, owner));

        assertEquals("INVITATION_MUST_BE_REVOKED", exception.getCode());
        verify(jdbc, never()).update(contains("SPRING_SESSION"), eq("staff@nexo.gt"));
        verify(users, never()).delete(user);
    }
}
