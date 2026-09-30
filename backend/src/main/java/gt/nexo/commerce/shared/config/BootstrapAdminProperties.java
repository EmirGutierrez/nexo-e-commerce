package gt.nexo.commerce.shared.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "nexo.bootstrap.admin")
public record BootstrapAdminProperties(boolean enabled, String name, String email, String password) {
}
