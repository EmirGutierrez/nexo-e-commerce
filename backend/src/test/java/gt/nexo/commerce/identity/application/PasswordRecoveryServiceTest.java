package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.business.application.BusinessEmailService;
import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.context.ApplicationEventPublisher;

class PasswordRecoveryServiceTest {
    private static final UUID USER_ID = UUID.randomUUID();
    private static final String EMAIL = "customer@example.test";
    private static final String NEW_PASSWORD = "a-new-secure-password";

    private final AppUserRepository users = mock(AppUserRepository.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    private final PasswordRecoveryService service = new PasswordRecoveryService(
            users, jdbc, passwordEncoder, eventPublisher, "https://shop.example.test/reset-password");

    @Test
    void requestsAHashedSingleUseTokenAndSendsAThirtyMinuteLink() throws Exception {
        AppUserEntity account = mock(AppUserEntity.class);
        when(account.getId()).thenReturn(USER_ID);
        when(account.getEmail()).thenReturn(EMAIL);
        when(account.getDisplayName()).thenReturn("Cliente NEXO");
        when(account.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(users.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(account));
        when(jdbc.update(contains("INSERT INTO password_reset_tokens"), eq(USER_ID), anyString(), any(OffsetDateTime.class)))
                .thenReturn(1);

        service.requestReset("  CUSTOMER@example.test ");

        ArgumentCaptor<String> storedHash = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<OffsetDateTime> expiresAt = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(jdbc).update(contains("INSERT INTO password_reset_tokens"), eq(USER_ID), storedHash.capture(), expiresAt.capture());
        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        BusinessEmailService.EmailRequested email = (BusinessEmailService.EmailRequested) eventCaptor.getValue();
        String token = email.body().substring(email.body().indexOf("?token=") + "?token=".length()).split("\\s", 2)[0];
        String expectedHash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8)));

        assertEquals(EMAIL, email.recipient());
        assertEquals(expectedHash, storedHash.getValue());
        assertNotEquals(token, storedHash.getValue());
        assertEquals("Restablece tu contraseña de NEXO Commerce", email.subject());
        assertEquals("https://shop.example.test/reset-password?token=" + token,
                email.body().substring(email.body().indexOf("https://"), email.body().indexOf("https://") + ("https://shop.example.test/reset-password?token=" + token).length()));
        assertEquals(30 * 60L, expiresAt.getValue().toInstant().getEpochSecond() - Instant.now().getEpochSecond(), 2);
    }

    @Test
    void doesNotRevealOrSendAResetForUnknownOrPendingAccounts() {
        AppUserEntity pending = mock(AppUserEntity.class);
        when(pending.getStatus()).thenReturn(UserStatus.PENDING);
        when(users.findByEmailIgnoreCase("missing@example.test")).thenReturn(Optional.empty());
        when(users.findByEmailIgnoreCase("pending@example.test")).thenReturn(Optional.of(pending));

        service.requestReset("missing@example.test");
        service.requestReset("pending@example.test");

        verifyNoInteractions(jdbc, eventPublisher);
    }

    @Test
    void enforcesPerAccountCooldownWithoutSendingRepeatedEmails() {
        AppUserEntity account = mock(AppUserEntity.class);
        when(account.getId()).thenReturn(USER_ID);
        when(account.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(users.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(account));
        when(jdbc.update(contains("INSERT INTO password_reset_tokens"), eq(USER_ID), anyString(), any(OffsetDateTime.class)))
                .thenReturn(0);

        service.requestReset(EMAIL);

        verifyNoInteractions(eventPublisher);
    }

    @Test
    void completesResetAndRevokesWebAndMobileSessions() {
        AppUserEntity account = mock(AppUserEntity.class);
        when(account.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(account.getEmail()).thenReturn(EMAIL);
        when(users.findByIdForPasswordChange(USER_ID)).thenReturn(Optional.of(account));
        when(jdbc.queryForObject(contains("FROM password_reset_tokens"), eq(UUID.class), anyString())).thenReturn(USER_ID);
        when(passwordEncoder.encode(NEW_PASSWORD)).thenReturn("{bcrypt}new-hash");

        service.completeReset("raw-reset-token", NEW_PASSWORD);

        ArgumentCaptor<String> tokenHash = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForObject(contains("FOR UPDATE OF reset"), eq(UUID.class), tokenHash.capture());
        assertNotEquals("raw-reset-token", tokenHash.getValue());
        verify(account).setPasswordHash("{bcrypt}new-hash");
        verify(jdbc).update("DELETE FROM password_reset_tokens WHERE user_id = ?", USER_ID);
        verify(jdbc).update("DELETE FROM SPRING_SESSION WHERE LOWER(PRINCIPAL_NAME) = LOWER(?)", EMAIL);
        verify(jdbc).update("DELETE FROM mobile_access_token WHERE user_id = ?", USER_ID);
    }

    @Test
    void rejectsExpiredOrAlreadyUsedTokens() {
        when(jdbc.queryForObject(contains("FROM password_reset_tokens"), eq(UUID.class), anyString()))
                .thenThrow(new EmptyResultDataAccessException(1));

        BusinessRuleException exception = assertThrows(BusinessRuleException.class,
                () -> service.completeReset("expired-token", NEW_PASSWORD));

        assertEquals("PASSWORD_RESET_INVALID", exception.getCode());
        verify(users, never()).findByIdForPasswordChange(any());
    }

    @Test
    void rejectsPasswordsExceedingTheBcryptByteLimitBeforeReadingTokens() {
        BusinessRuleException exception = assertThrows(BusinessRuleException.class,
                () -> service.completeReset("valid-token", "a".repeat(73)));

        assertEquals("PASSWORD_TOO_LONG", exception.getCode());
        verifyNoInteractions(jdbc, users);
    }
}
