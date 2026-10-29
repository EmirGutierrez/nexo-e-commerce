package gt.nexo.commerce.shared.security;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import gt.nexo.commerce.identity.application.MobileSessionService;
import gt.nexo.commerce.identity.application.MobileTokenAuthenticationDetails;
import gt.nexo.commerce.identity.application.MfaService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.convert.ConversionService;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = MobileJwtCsrfSecurityTest.TestConfiguration.class)
@WebAppConfiguration
@TestPropertySource(properties = "nexo.web.allowed-origins=http://localhost")
class MobileJwtCsrfSecurityTest {
    private static final String VALID_TOKEN = "valid-mobile-jwt";
    private static final String INVALID_TOKEN = "invalid-mobile-jwt";

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private MobileSessionService sessions;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        reset(sessions);
        SecurityContextHolder.clearContext();
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/mobile/probe", "/api/business/probe", "/api/users/probe", "/api/roles/probe"})
    void permitsValidatedMobileJwtWritesWithoutCsrf(String path) throws Exception {
        when(sessions.authenticate(VALID_TOKEN)).thenReturn(Optional.of(mobileAuthentication()));

        mvc.perform(write(path).header("Authorization", "Bearer " + VALID_TOKEN))
                .andExpect(status().isOk())
                .andExpect(content().string("mobile-user"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/mobile/probe", "/api/business/probe", "/api/users/probe", "/api/roles/probe"})
    void requiresCsrfForCookieAuthenticatedWrites(String path) throws Exception {
        mvc.perform(write(path).session(webSession(webAuthentication())))
                .andExpect(status().isForbidden());
    }

    @Test
    void permitsCookieAuthenticatedWritesWithCsrf() throws Exception {
        mvc.perform(write("/api/business/probe").session(webSession(webAuthentication())).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(content().string("web-user"));
    }

    @Test
    void doesNotExtendTheMobileCsrfExceptionToWebAuthenticationRoutes() throws Exception {
        when(sessions.authenticate(VALID_TOKEN)).thenReturn(Optional.of(mobileAuthentication()));

        mvc.perform(write("/api/auth/probe").header("Authorization", "Bearer " + VALID_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    void doesNotExemptCookieRequestsMerelyBecauseTheStoredAuthenticationHasMobileDetails() throws Exception {
        mvc.perform(write("/api/business/probe").session(webSession(mobileAuthentication())))
                .andExpect(status().isForbidden());
    }

    @Test
    void requiresValidatedMobileDetailsForBearerCsrfExemption() throws Exception {
        when(sessions.authenticate(VALID_TOKEN)).thenReturn(Optional.of(webAuthentication()));

        mvc.perform(write("/api/business/probe").header("Authorization", "Bearer " + VALID_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsAnInvalidBearerInsteadOfFallingBackToTheCookie() throws Exception {
        when(sessions.authenticate(INVALID_TOKEN)).thenReturn(Optional.empty());
        Authentication webAuthentication = webAuthentication();
        MockHttpSession session = webSession(webAuthentication);
        SecurityContext storedContext = (SecurityContext) session.getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);

        mvc.perform(write("/api/business/probe").session(session)
                        .header("Authorization", "Bearer " + INVALID_TOKEN))
                .andExpect(status().isUnauthorized());

        assertSame(webAuthentication, storedContext.getAuthentication());
    }

    @Test
    void rejectsAnInvalidBearerEvenWhenTheCookieAndCsrfAreValid() throws Exception {
        when(sessions.authenticate(INVALID_TOKEN)).thenReturn(Optional.empty());

        mvc.perform(write("/api/business/probe").session(webSession(webAuthentication()))
                        .header("Authorization", "Bearer " + INVALID_TOKEN).with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void doesNotReplaceTheAuthenticationStoredInTheBrowserSession() throws Exception {
        when(sessions.authenticate(VALID_TOKEN)).thenReturn(Optional.of(mobileAuthentication()));
        Authentication webAuthentication = webAuthentication();
        MockHttpSession session = webSession(webAuthentication);
        SecurityContext storedContext = (SecurityContext) session.getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);

        mvc.perform(write("/api/business/probe").session(session)
                        .header("Authorization", "Bearer " + VALID_TOKEN))
                .andExpect(status().isOk())
                .andExpect(content().string("mobile-user"));

        assertSame(webAuthentication, storedContext.getAuthentication());
    }

    @Test
    void keepsMobileLoginPublicWithoutCsrf() throws Exception {
        mvc.perform(write("/api/mobile/auth/login"))
                .andExpect(status().isOk())
                .andExpect(content().string("anonymous"));
    }

    private static MockHttpServletRequestBuilder write(String path) {
        return post(path).servletPath(path);
    }

    private static Authentication webAuthentication() {
        return UsernamePasswordAuthenticationToken.authenticated("web-user", null, List.of());
    }

    private static Authentication mobileAuthentication() {
        UsernamePasswordAuthenticationToken authentication =
                UsernamePasswordAuthenticationToken.authenticated("mobile-user", null, List.of());
        authentication.setDetails(new MobileTokenAuthenticationDetails("validated-mobile-token-hash"));
        return authentication;
    }

    private static MockHttpSession webSession(Authentication authentication) {
        SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(authentication);
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, securityContext);
        return session;
    }

    @Configuration(proxyBeanMethods = false)
    @EnableWebMvc
    @EnableWebSecurity
    @Import(SecurityConfiguration.class)
    static class TestConfiguration {
        @Bean(name = "conversionService")
        ConversionService conversionService() {
            return ApplicationConversionService.getSharedInstance();
        }

        @Bean
        MobileSessionService mobileSessionService() {
            return mock(MobileSessionService.class);
        }

        @Bean
        MfaService mfaService() {
            return mock(MfaService.class);
        }

        @Bean
        ObjectMapper objectMapper() {
            return mock(ObjectMapper.class);
        }

        @Bean
        UserDetailsService userDetailsService() {
            return username -> {
                throw new UsernameNotFoundException(username);
            };
        }

        @Bean
        ProbeController probeController() {
            return new ProbeController();
        }
    }

    @RestController
    static class ProbeController {
        @PostMapping({"/api/mobile/probe", "/api/business/probe", "/api/users/probe", "/api/roles/probe",
                "/api/auth/probe", "/api/mobile/auth/login"})
        String write(Authentication authentication) {
            return authentication == null ? "anonymous" : authentication.getName();
        }
    }
}
