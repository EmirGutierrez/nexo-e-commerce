package gt.nexo.commerce.shared.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = ProductionPrometheusSecurityConfigurationTest.TestConfiguration.class)
@WebAppConfiguration
@ActiveProfiles("prod")
@TestPropertySource(properties = "nexo.metrics.prometheus-token=0123456789abcdef0123456789abcdef")
class ProductionPrometheusSecurityConfigurationTest {
    private static final String TOKEN = "0123456789abcdef0123456789abcdef";

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
    }

    @Test
    void allowsPrometheusScrapesOnlyWithTheConfiguredBearerToken() throws Exception {
        mvc.perform(get("/actuator/prometheus").servletPath("/actuator/prometheus")
                        .header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(content().string("metrics"));
    }

    @Test
    void rejectsPrometheusScrapesWithoutAnAuthorizationHeader() throws Exception {
        mvc.perform(get("/actuator/prometheus").servletPath("/actuator/prometheus"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsPrometheusScrapesWithAnIncorrectBearerToken() throws Exception {
        mvc.perform(get("/actuator/prometheus").servletPath("/actuator/prometheus")
                        .header("Authorization", "Bearer 0123456789abcdef0123456789abcdeX"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsPrometheusScrapesWithAnotherAuthorizationScheme() throws Exception {
        mvc.perform(get("/actuator/prometheus").servletPath("/actuator/prometheus")
                        .header("Authorization", "Basic " + TOKEN))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsWritesEvenWhenTheyIncludeTheCorrectToken() throws Exception {
        mvc.perform(post("/actuator/prometheus").servletPath("/actuator/prometheus")
                        .header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    void tokenFilterRejectsNonGetRequestsWhenTheFilterReceivesThem() throws Exception {
        PrometheusTokenFilter filter = new PrometheusTokenFilter(TOKEN);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/actuator/prometheus");
        request.addHeader("Authorization", "Bearer " + TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(401, response.getStatus());
    }

    @Test
    void refusesMissingOrWeakConfiguredTokens() {
        assertThrows(IllegalStateException.class, () -> new PrometheusTokenFilter(null));
        assertThrows(IllegalStateException.class, () -> new PrometheusTokenFilter("too-short"));
    }

    @Configuration(proxyBeanMethods = false)
    @EnableWebMvc
    @EnableWebSecurity
    @Import(ProductionPrometheusSecurityConfiguration.class)
    static class TestConfiguration {
        @Bean
        PrometheusProbeController prometheusProbeController() {
            return new PrometheusProbeController();
        }
    }

    @RestController
    static class PrometheusProbeController {
        @GetMapping("/actuator/prometheus")
        String scrape() {
            return "metrics";
        }
    }
}
