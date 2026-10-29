package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.MobileAccessTokenEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.MobileAccessTokenRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.PermissionEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.PermissionId;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

class MobileSessionServiceTest {
    private final MobileAccessTokenRepository repository = mock(MobileAccessTokenRepository.class);
    private final Map<String, MobileAccessTokenEntity> storedTokens = new HashMap<>();
    private final MobileJwtConfiguration configuration = new MobileJwtConfiguration();
    private final SecretKey key = configuration.mobileJwtSecretKey(new MockEnvironment().withProperty(
            "MOBILE_JWT_SECRET", Base64.getEncoder().encodeToString(
                    "01234567890123456789012345678901".getBytes(StandardCharsets.US_ASCII))));
    private final JwtEncoder encoder = configuration.mobileJwtEncoder(key);
    private final JwtDecoder decoder = configuration.mobileJwtDecoder(key);
    private final MobileSessionService service = new MobileSessionService(
            repository, Duration.ofDays(7), encoder, decoder);

    @BeforeEach
    void persistMockTokensByHash() {
        when(repository.save(any(MobileAccessTokenEntity.class))).thenAnswer(invocation -> {
            MobileAccessTokenEntity token = invocation.getArgument(0);
            storedTokens.put(token.getTokenHash(), token);
            return token;
        });
        when(repository.findByTokenHash(anyString())).thenAnswer(invocation ->
                Optional.ofNullable(storedTokens.get(invocation.getArgument(0, String.class))));
        when(repository.deleteByTokenHash(anyString())).thenAnswer(invocation ->
                storedTokens.remove(invocation.getArgument(0, String.class)) == null ? 0 : 1);
    }

    @Test
    void issuesSignedMobileClaimsAndPersistsOnlyTheTokenHash() throws Exception {
        AppUserEntity account = account("sales");
        var issued = service.issue(account);
        var jwt = decoder.decode(issued.accessToken());
        MobileAccessTokenEntity stored = storedTokens.get(sha256(issued.accessToken()));

        assertEquals(3, issued.accessToken().split("[.]").length);
        assertEquals(account.getId().toString(), jwt.getSubject());
        assertEquals(issued.expiresAt().getEpochSecond(), jwt.getExpiresAt().getEpochSecond());
        assertEquals(64, stored.getTokenHash().length());
        assertNotEquals(issued.accessToken(), stored.getTokenHash());
        assertEquals(account, stored.getUser());
        assertFalse(jwt.getClaims().containsKey("password"));
        assertFalse(jwt.getClaims().containsKey("email"));
        assertFalse(jwt.getClaims().containsKey("permissions"));
    }

    @Test
    void loadsTheCurrentAccountRoleAndPermissionsInsteadOfEmbeddingThemInTheJwt() {
        AppUserEntity account = account("sales");
        var issued = service.issue(account);
        RoleEntity inventoryRole = role("inventory");
        PermissionEntity permission = mock(PermissionEntity.class);
        PermissionId permissionId = mock(PermissionId.class);
        when(permissionId.getModuleCode()).thenReturn("inventory");
        when(permissionId.getActionCode()).thenReturn("view");
        when(permission.getId()).thenReturn(permissionId);
        when(inventoryRole.getPermissions()).thenReturn(Set.of(permission));
        account.changeRole(inventoryRole);

        Authentication authentication = service.authenticate(issued.accessToken()).orElseThrow();
        NexoUserPrincipal principal = (NexoUserPrincipal) authentication.getPrincipal();

        assertEquals("inventory", principal.getRoleCode());
        assertEquals(Set.of("inventory:view"), Set.copyOf(principal.getPermissions()));
        assertTrue(authentication.getAuthorities().stream().anyMatch(
                authority -> authority.getAuthority().equals("PERMISSION_inventory_view")));
    }

    @Test
    void revokesTheServerRecordSoTheSameSignedJwtCannotBeUsedAgain() {
        var issued = service.issue(account("sales"));
        Authentication authentication = service.authenticate(issued.accessToken()).orElseThrow();

        service.revoke(authentication);

        assertTrue(storedTokens.isEmpty());
        assertTrue(service.authenticate(issued.accessToken()).isEmpty());
    }

    @Test
    void rejectsAValidSignedJwtIfItsServerRecordIsMissing() {
        var issued = service.issue(account("sales"));
        storedTokens.clear();

        assertTrue(service.authenticate(issued.accessToken()).isEmpty());
    }

    @ParameterizedTest
    @EnumSource(value = UserStatus.class, names = { "PENDING", "LOCKED", "DISABLED" })
    void rejectsAndRevokesTokensWhenTheAccountIsNoLongerActive(UserStatus status) {
        AppUserEntity account = account("sales");
        var issued = service.issue(account);
        account.changeStatus(status);

        assertTrue(service.authenticate(issued.accessToken()).isEmpty());
        assertTrue(storedTokens.isEmpty());
    }

    @Test
    void rejectsAndRevokesARecordAttachedToADifferentAccount() {
        var issued = service.issue(account("sales"));
        String hash = storedTokens.keySet().iterator().next();
        storedTokens.put(hash, new MobileAccessTokenEntity(
                hash, account("sales"), Instant.now(), issued.expiresAt()));

        assertTrue(service.authenticate(issued.accessToken()).isEmpty());
        assertTrue(storedTokens.isEmpty());
    }

    @Test
    void rejectsAndRevokesARecordWhoseServerExpiryHasPassed() {
        AppUserEntity account = account("sales");
        var issued = service.issue(account);
        String hash = storedTokens.keySet().iterator().next();
        storedTokens.put(hash, new MobileAccessTokenEntity(
                hash, account, Instant.now().minusSeconds(120), Instant.now().minusSeconds(1)));

        assertTrue(service.authenticate(issued.accessToken()).isEmpty());
        assertTrue(storedTokens.isEmpty());
    }

    @Test
    void rejectsMalformedLegacyAndTamperedTokensBeforeLookingThemUp() {
        var issued = service.issue(account("sales"));
        String[] parts = issued.accessToken().split("[.]");
        parts[2] = (parts[2].charAt(0) == 'A' ? "B" : "A") + parts[2].substring(1);
        clearInvocations(repository);

        assertTrue(service.authenticate(null).isEmpty());
        assertTrue(service.authenticate("oldOpaqueToken".repeat(3)).isEmpty());
        assertTrue(service.authenticate("a".repeat(4097)).isEmpty());
        assertTrue(service.authenticate(String.join(".", parts)).isEmpty());

        verify(repository, never()).findByTokenHash(anyString());
    }

    @Test
    void refusesToRevokeAnAuthenticationWithoutMobileTokenDetails() {
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                "staff@example.test", null, Set.of());

        assertThrows(AccessDeniedException.class, () -> service.revoke(authentication));
    }

    private AppUserEntity account(String roleCode) {
        return new AppUserEntity(UUID.randomUUID(), "staff@example.test", "Staff", "{bcrypt}test-only",
                role(roleCode), UserStatus.ACTIVE);
    }

    private RoleEntity role(String roleCode) {
        RoleEntity role = mock(RoleEntity.class);
        when(role.getCode()).thenReturn(roleCode);
        when(role.getPermissions()).thenReturn(Set.of());
        return role;
    }

    private String sha256(String token) throws Exception {
        return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII)));
    }
}
