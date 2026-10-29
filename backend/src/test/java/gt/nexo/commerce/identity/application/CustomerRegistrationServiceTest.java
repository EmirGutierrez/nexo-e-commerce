package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.api.dto.RegisterRequest;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

class CustomerRegistrationServiceTest {
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final RoleRepository roles = mock(RoleRepository.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final CustomerRegistrationService service = new CustomerRegistrationService(users, roles, passwords, jdbc);

    @Test
    void rejectsHtmlNamesBeforeRegistrationWrites() {
        assertThrows(BusinessRuleException.class, () -> service.register(new RegisterRequest(
                "<img src=x onerror=alert(1)>", "ana@example.test", "LongEnoughPassword123!")));

        verify(users, never()).saveAndFlush(any(AppUserEntity.class));
        org.mockito.Mockito.verifyNoInteractions(roles, passwords, jdbc);
    }

    @Test
    void acceptsInternationalPlainTextName() {
        RoleEntity customerRole = mock(RoleEntity.class);
        when(roles.findById("customer")).thenReturn(Optional.of(customerRole));
        when(users.findByEmailIgnoreCase("ana@example.test")).thenReturn(Optional.empty());
        when(passwords.encode(anyString())).thenReturn("encoded-test-password");
        when(users.saveAndFlush(any(AppUserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.register(new RegisterRequest("María O’Connor", "ana@example.test", "LongEnoughPassword123!"));

        verify(jdbc).update(contains("INSERT INTO business_records"), any(), eq("María O’Connor"), eq("ana@example.test"), any());
    }
}
