package gt.nexo.commerce.shared.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PrometheusTestController.class,
        properties = "nexo.metrics.prometheus-token=0123456789abcdef0123456789abcdef")
@Import(ProductionPrometheusSecurityConfiguration.class)
@ActiveProfiles("prod")
class ProductionPrometheusSecurityConfigurationTest {
    private static final String TOKEN = "0123456789abcdef0123456789abcdef";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FilterChainProxy securityFilterChain;

    @Test
    void requiresBearerTokenForGetScrapes() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/actuator/prometheus").header(HttpHeaders.AUTHORIZATION, "Basic " + TOKEN))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/actuator/prometheus").header(HttpHeaders.AUTHORIZATION, "Bearer incorrect-token"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/actuator/prometheus").header(HttpHeaders.AUTHORIZATION, "Bearer " + TOKEN))
                .andExpect(status().isOk());

        assertPrometheusChainRetainsCsrf();
    }

    @Test
    void rejectsPostWithoutCsrfTokenEvenWithTheCorrectScrapeToken() throws Exception {
        mockMvc.perform(post("/actuator/prometheus")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + TOKEN))
                .andExpect(status().isForbidden());
    }

    private void assertPrometheusChainRetainsCsrf() {
        boolean hasCsrfFilter = securityFilterChain.getFilterChains().stream()
                .filter(chain -> chain.matches(new org.springframework.mock.web.MockHttpServletRequest(
                        "GET", "/actuator/prometheus")))
                .flatMap(chain -> chain.getFilters().stream())
                .anyMatch(CsrfFilter.class::isInstance);

        org.junit.jupiter.api.Assertions.assertTrue(hasCsrfFilter,
                "La cadena de producción de Prometheus debe conservar la protección CSRF.");
    }
}
