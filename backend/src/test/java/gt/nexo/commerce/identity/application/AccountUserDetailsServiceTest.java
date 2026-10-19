package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import java.lang.reflect.Method;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;

class AccountUserDetailsServiceTest {
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final AccountUserDetailsService service = new AccountUserDetailsService(users);

    @Test
    void normalizesEmailBeforeSearching() {
        when(users.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        assertThrows(UsernameNotFoundException.class,
                () -> service.loadUserByUsername("  MISSING@Example.com  "));

        verify(users).findByEmailIgnoreCase("missing@example.com");
    }

    @Test
    void missingAccountDoesNotMarkTheAuthenticationTransactionForRollback() throws Exception {
        Method method = AccountUserDetailsService.class.getMethod("loadUserByUsername", String.class);
        var transactionAttribute = new AnnotationTransactionAttributeSource()
                .getTransactionAttribute(method, AccountUserDetailsService.class);

        assertFalse(transactionAttribute.rollbackOn(new UsernameNotFoundException("Account not found")));
    }
}
