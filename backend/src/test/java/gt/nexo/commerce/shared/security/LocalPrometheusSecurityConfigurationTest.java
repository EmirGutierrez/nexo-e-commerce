package gt.nexo.commerce.shared.security;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PrometheusTestController.class)
@Import(LocalPrometheusSecurityConfiguration.class)
@ActiveProfiles("local")
class LocalPrometheusSecurityConfigurationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FilterChainProxy securityFilterChain;

    @Test
    void permitsUnauthenticatedGetScrapesAndKeepsCsrfProtection() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk());

        assertPrometheusChainRetainsCsrf();
    }

    @Test
    void deniesMethodsOtherThanGet() throws Exception {
        mockMvc.perform(post("/actuator/prometheus").with(csrf()))
                .andExpect(status().isForbidden());
    }

    private void assertPrometheusChainRetainsCsrf() {
        boolean hasCsrfFilter = securityFilterChain.getFilterChains().stream()
                .filter(chain -> chain.matches(new org.springframework.mock.web.MockHttpServletRequest(
                        "GET", "/actuator/prometheus")))
                .flatMap(chain -> chain.getFilters().stream())
                .anyMatch(CsrfFilter.class::isInstance);

        org.junit.jupiter.api.Assertions.assertTrue(hasCsrfFilter,
                "La cadena local de Prometheus debe conservar la protección CSRF.");
    }
}
