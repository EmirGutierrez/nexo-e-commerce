package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.api.dto.PasswordChangeRequest;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import gt.nexo.commerce.shared.errors.InvalidCredentialsException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordChangeServiceTest {
    private static final UUID USER_ID = UUID.randomUUID();
    private static final String EMAIL = "admin@nexo.gt";
    private static final String CURRENT_PASSWORD = "current-password";
    private static final String NEW_PASSWORD = "new-very-long-password";
    private static final String PASSWORD_HASH = "{bcrypt}current-hash";

    private final AppUserRepository users = mock(AppUserRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final MfaService mfaService = mock(MfaService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PasswordChangeService service = new PasswordChangeService(users, passwordEncoder, mfaService, jdbc);

    @Test
    void changesTheHashAndRevokesAllSessionsAfterCheckingBothPasswordsAndMfa() {
        AppUserEntity account = activeAccount();
        when(passwordEncoder.matches(CURRENT_PASSWORD, PASSWORD_HASH)).thenReturn(true);
        when(passwordEncoder.matches(NEW_PASSWORD, PASSWORD_HASH)).thenReturn(false);
        when(passwordEncoder.encode(NEW_PASSWORD)).thenReturn("{bcrypt}new-hash");

        service.change(USER_ID, new PasswordChangeRequest(CURRENT_PASSWORD, NEW_PASSWORD, "123456"));

        verify(mfaService).verifyLogin(USER_ID, "123456");
        verify(account).setPasswordHash("{bcrypt}new-hash");
        verify(jdbc).update("DELETE FROM SPRING_SESSION WHERE LOWER(PRINCIPAL_NAME) = LOWER(?)", EMAIL);
        verify(jdbc).update("DELETE FROM mobile_access_token WHERE user_id = ?", USER_ID);
    }

    @Test
    void rejectsAnIncorrectCurrentPasswordBeforeChangingMfaOrSessions() {
        activeAccount();
        when(passwordEncoder.matches(CURRENT_PASSWORD, PASSWORD_HASH)).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> service.change(USER_ID,
                new PasswordChangeRequest(CURRENT_PASSWORD, NEW_PASSWORD, null)));

        verifyNoInteractions(mfaService, jdbc);
    }

    @Test
    void rejectsAReplacementPasswordThatExceedsTheBcryptByteLimit() {
        activeAccount();
        when(passwordEncoder.matches(CURRENT_PASSWORD, PASSWORD_HASH)).thenReturn(true);
        String tooLong = "a".repeat(73);

        assertThrows(BusinessRuleException.class, () -> service.change(USER_ID,
                new PasswordChangeRequest(CURRENT_PASSWORD, tooLong, null)));

        verify(mfaService, never()).verifyLogin(any(), any());
        verifyNoInteractions(jdbc);
    }

    @Test
    void rejectsReusingTheCurrentPassword() {
        activeAccount();
        when(passwordEncoder.matches(CURRENT_PASSWORD, PASSWORD_HASH)).thenReturn(true);
        when(passwordEncoder.matches(NEW_PASSWORD, PASSWORD_HASH)).thenReturn(true);

        assertThrows(BusinessRuleException.class, () -> service.change(USER_ID,
                new PasswordChangeRequest(CURRENT_PASSWORD, NEW_PASSWORD, null)));

        verifyNoInteractions(mfaService, jdbc);
    }

    private AppUserEntity activeAccount() {
        AppUserEntity account = mock(AppUserEntity.class);
        when(users.findByIdForPasswordChange(USER_ID)).thenReturn(Optional.of(account));
        when(account.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(account.isCurrentlyLocked(any())).thenReturn(false);
        when(account.getPasswordHash()).thenReturn(PASSWORD_HASH);
        when(account.getEmail()).thenReturn(EMAIL);
        return account;
    }
}
