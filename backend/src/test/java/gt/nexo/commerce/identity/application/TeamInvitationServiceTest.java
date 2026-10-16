package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.api.dto.TeamInvitationRequest;
import gt.nexo.commerce.identity.api.dto.TeamInvitationResponse;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleRepository;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

class TeamInvitationServiceTest {
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final RoleRepository roles = mock(RoleRepository.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final PermissionAuthorizer permissions = mock(PermissionAuthorizer.class);
    private final TeamInvitationService service = new TeamInvitationService(
            users, roles, jdbc, passwordEncoder, permissions);

    @Test
    void persistsInvitationExpiryAsJdbcTimestamp() {
        String email = "danny@example.com";
        RoleEntity adminRole = mock(RoleEntity.class);
        when(permissions.has(any(), eq("users"), eq("create"))).thenReturn(true);
        when(roles.findById("admin")).thenReturn(Optional.of(adminRole));
        when(users.findByEmailIgnoreCase(email)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-initial-secret");
        when(users.saveAndFlush(any(AppUserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TeamInvitationResponse invitation = service.invite(
                new TeamInvitationRequest("Danny Velásquez", email, "admin"), mock(Authentication.class));

        ArgumentCaptor<OffsetDateTime> expiry = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(jdbc).update(contains("INSERT INTO user_invitations"), eq(invitation.id()), anyString(),
                expiry.capture(), isNull());
        Instant now = Instant.now();
        assertEquals(ZoneOffset.UTC, expiry.getValue().getOffset());
        assertTrue(expiry.getValue().toInstant().isAfter(now.plusSeconds(47 * 60 * 60L)));
        assertTrue(expiry.getValue().toInstant().isBefore(now.plusSeconds(49 * 60 * 60L)));
        assertEquals("PENDING", invitation.status());
        assertEquals(email, invitation.email());
    }
}
