package gt.nexo.commerce.shared.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;

@Configuration(proxyBeanMethods = false)
@Profile("prod")
public class ProductionPrometheusSecurityConfiguration {

    @Bean
    @Order(0)
    SecurityFilterChain productionPrometheusSecurityFilterChain(
            HttpSecurity http,
            @Value("${nexo.metrics.prometheus-token}") String prometheusToken) throws Exception {
        return http
                .securityMatcher("/actuator/prometheus")
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new PrometheusTokenFilter(prometheusToken), AuthorizationFilter.class)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.GET, "/actuator/prometheus").permitAll()
                        .anyRequest().denyAll())
                .build();
    }
}
