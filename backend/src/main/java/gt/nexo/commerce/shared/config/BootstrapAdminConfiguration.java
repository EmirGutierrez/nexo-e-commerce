package gt.nexo.commerce.shared.config;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

@Configuration(proxyBeanMethods = false)
public class BootstrapAdminConfiguration {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    @Bean
    ApplicationRunner bootstrapAdmin(BootstrapAdminProperties properties,
                                     AppUserRepository users,
                                     RoleRepository roles,
                                     PasswordEncoder passwordEncoder) {
        return arguments -> {
            boolean anyValueProvided = hasText(properties.name()) || hasText(properties.email()) || hasText(properties.password());
            if (!properties.enabled()) {
                if (anyValueProvided) {
                    throw new IllegalStateException("Bootstrap credentials are set while BOOTSTRAP_ADMIN_ENABLED is false. Remove them or explicitly enable the one-time bootstrap.");
                }
                return;
            }

            String name = properties.name() == null ? "" : properties.name().trim();
            String email = properties.email() == null ? "" : properties.email().trim().toLowerCase(Locale.ROOT);
            String password = properties.password() == null ? "" : properties.password();
            if (name.isEmpty() || name.length() > 160 || !EMAIL_PATTERN.matcher(email).matches()
                    || password.length() < 16 || password.length() > 128) {
                throw new IllegalStateException("Bootstrap requires a valid name and email plus a password of 16–128 characters.");
            }
            if (users.count() > 0) {
                throw new IllegalStateException("Bootstrap was enabled after users already existed. Disable BOOTSTRAP_ADMIN_ENABLED and remove the bootstrap secrets.");
            }
            RoleEntity superadmin = roles.findById("superadmin")
                    .orElseThrow(() -> new IllegalStateException("The superadmin role is missing from the Flyway seed."));
            users.save(new AppUserEntity(UUID.randomUUID(), email, name,
                    passwordEncoder.encode(password), superadmin, UserStatus.ACTIVE));
        };
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
