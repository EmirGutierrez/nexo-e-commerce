package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.api.dto.LoginRequest;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import gt.nexo.commerce.shared.errors.InactiveAccountException;
import gt.nexo.commerce.shared.errors.InvalidCredentialsException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;

class AuthenticationServiceTest {
    private static final String EMAIL = "inactive@nexo.gt";
    private static final String PASSWORD = "valid-password";
    private static final String PASSWORD_HASH = "{bcrypt}stored-hash";

    private final AuthenticationManager authenticationManager = mock(AuthenticationManager.class);
    private final SecurityContextRepository securityContextRepository = mock(SecurityContextRepository.class);
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy =
            mock(SessionAuthenticationStrategy.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final UserAccountService userAccountService = mock(UserAccountService.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final AuthenticationService service = new AuthenticationService(
            authenticationManager, securityContextRepository, sessionAuthenticationStrategy,
            users, userAccountService, passwordEncoder);

    @Test
    void reportsDisabledAccountsOnlyAfterVerifyingTheirPasswordForWebAndMobile() {
        AppUserEntity account = mock(AppUserEntity.class);
        when(users.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(account));
        when(account.getStatus()).thenReturn(UserStatus.DISABLED);
        when(account.getPasswordHash()).thenReturn(PASSWORD_HASH);
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
        LoginRequest request = new LoginRequest(EMAIL, PASSWORD);

        InactiveAccountException webError = assertThrows(InactiveAccountException.class,
                () -> service.login(request, mock(HttpServletRequest.class), mock(HttpServletResponse.class)));
        InactiveAccountException mobileError = assertThrows(InactiveAccountException.class,
                () -> service.authenticateMobile(request));

        assertEquals("Tu cuenta está inactiva. Contacta al administrador para solicitar que la reactive.",
                webError.getMessage());
        assertEquals(webError.getMessage(), mobileError.getMessage());
        verify(authenticationManager, never()).authenticate(any());
        verifyNoInteractions(securityContextRepository, sessionAuthenticationStrategy, userAccountService);
    }

    @Test
    void doesNotRevealDisabledAccountWhenThePasswordDoesNotMatch() {
        AppUserEntity account = mock(AppUserEntity.class);
        when(users.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(account));
        when(account.getStatus()).thenReturn(UserStatus.DISABLED);
        when(account.getPasswordHash()).thenReturn(PASSWORD_HASH);
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(false);
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad credentials"));

        assertThrows(InvalidCredentialsException.class,
                () -> service.authenticateMobile(new LoginRequest(EMAIL, PASSWORD)));
    }
}
