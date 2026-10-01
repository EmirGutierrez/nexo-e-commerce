package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.api.dto.RegisterRequest;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import gt.nexo.commerce.shared.errors.AccountAlreadyExistsException;
import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerRegistrationService {
    private final AppUserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;

    public CustomerRegistrationService(AppUserRepository users, RoleRepository roles, PasswordEncoder passwordEncoder, JdbcTemplate jdbc) {
        this.users = users;
        this.roles = roles;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
    }

    @Transactional
    public void register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.findByEmailIgnoreCase(email).isPresent()) throw new AccountAlreadyExistsException();

        RoleEntity customer = roles.findById("customer")
                .orElseThrow(() -> new IllegalStateException("The customer role is missing from Flyway migrations."));
        try {
            UUID id = UUID.randomUUID();
            users.saveAndFlush(new AppUserEntity(id, email, request.name().trim(),
                    passwordEncoder.encode(request.password()), customer, UserStatus.ACTIVE));
            jdbc.update("""
                    INSERT INTO business_records (id, resource_code, data, status_code, created_by)
                    VALUES (?, 'customers', jsonb_build_object('name', ?, 'email', ?, 'status', 'Activo'), 'Activo', ?)
                    """, id, request.name().trim(), email, id);
            jdbc.update("""
                    INSERT INTO customers (record_id, name, email, status) VALUES (?, ?, ?, 'Activo')
                    """, id, request.name().trim(), email);
        } catch (DataIntegrityViolationException exception) {
            throw new AccountAlreadyExistsException();
        }
    }
}
