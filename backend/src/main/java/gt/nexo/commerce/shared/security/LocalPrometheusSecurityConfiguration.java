package gt.nexo.commerce.shared.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@Profile("local")
public class LocalPrometheusSecurityConfiguration {

    @Bean
    @Order(0)
    SecurityFilterChain localPrometheusSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
                .securityMatcher("/actuator/prometheus")
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, "/actuator/prometheus").permitAll()
                        .anyRequest().denyAll())
                .build();
    }
}
