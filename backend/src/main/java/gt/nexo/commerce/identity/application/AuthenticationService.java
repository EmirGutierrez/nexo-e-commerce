package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.api.dto.LoginRequest;
import gt.nexo.commerce.identity.api.dto.UserResponse;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import gt.nexo.commerce.shared.errors.InactiveAccountException;
import gt.nexo.commerce.shared.errors.InvalidCredentialsException;
import gt.nexo.commerce.shared.security.AuthenticatedSessionLifetimeFilter;
import gt.nexo.commerce.shared.security.MfaSessionVerification;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.Locale;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticationService {
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;
    private final AppUserRepository users;
    private final UserAccountService userAccountService;
    private final PasswordEncoder passwordEncoder;
    private final MfaService mfaService;

    public AuthenticationService(AuthenticationManager authenticationManager,
                                  SecurityContextRepository securityContextRepository,
                                  SessionAuthenticationStrategy sessionAuthenticationStrategy,
                                  AppUserRepository users,
                                  UserAccountService userAccountService,
                                  PasswordEncoder passwordEncoder,
                                  MfaService mfaService) {
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
        this.users = users;
        this.userAccountService = userAccountService;
        this.passwordEncoder = passwordEncoder;
        this.mfaService = mfaService;
    }

    @Transactional(noRollbackFor = InvalidCredentialsException.class)
    public UserResponse login(LoginRequest request, HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        AuthenticatedCredentials credentials = authenticateCredentials(request);
        Authentication authentication = credentials.authentication();
        Instant authenticatedAt = Instant.now();
        sessionAuthenticationStrategy.onAuthentication(authentication, servletRequest, servletResponse);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, servletRequest, servletResponse);
        var session = servletRequest.getSession(false);
        if (session != null) {
            session.setAttribute(AuthenticatedSessionLifetimeFilter.AUTHENTICATED_AT_ATTRIBUTE, authenticatedAt.toEpochMilli());
            if (credentials.mfaVerified()) MfaSessionVerification.markVerified(session, ((NexoUserPrincipal) authentication.getPrincipal()).getId());
            else session.removeAttribute(MfaSessionVerification.VERIFIED_USER_ATTRIBUTE);
        }

        AppUserEntity account = recordSuccessfulLogin(authentication, authenticatedAt);
        return userAccountService.currentUser(account.getId());
    }

    @Transactional(noRollbackFor = InvalidCredentialsException.class)
    public AppUserEntity authenticateMobile(LoginRequest request) {
        AuthenticatedCredentials credentials = authenticateCredentials(request);
        Authentication authentication = credentials.authentication();
        NexoUserPrincipal principal = (NexoUserPrincipal) authentication.getPrincipal();
        if (mfaService.isRequired(principal.getId()) && !credentials.mfaVerified()) {
            throw MfaChallengeException.enrollmentRequired();
        }
        return recordSuccessfulLogin(authentication, Instant.now());
    }

    private AuthenticatedCredentials authenticateCredentials(LoginRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        var existingAccount = users.findByEmailIgnoreCase(email);
        if (existingAccount.filter(user -> user.getStatus() == UserStatus.DISABLED)
                .filter(user -> passwordEncoder.matches(request.password(), user.getPasswordHash()))
                .isPresent()) {
            throw new InactiveAccountException();
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(email, request.password()));
            NexoUserPrincipal principal = (NexoUserPrincipal) authentication.getPrincipal();
            boolean mfaVerified = mfaService.verifyLogin(principal.getId(), request.mfaCode());
            return new AuthenticatedCredentials(authentication, mfaVerified);
        } catch (AuthenticationException exception) {
            // Authentication is throttled by source IP before Spring's password hash check.
            // Avoid account lockout here: a remote attacker could otherwise disable any known account.
            throw new InvalidCredentialsException();
        }
    }

    private record AuthenticatedCredentials(Authentication authentication, boolean mfaVerified) { }

    private AppUserEntity recordSuccessfulLogin(Authentication authentication, Instant authenticatedAt) {
        NexoUserPrincipal principal = (NexoUserPrincipal) authentication.getPrincipal();
        AppUserEntity account = users.findById(principal.getId())
                .orElseThrow(() -> new AuthenticationServiceException("Authenticated account disappeared"));
        account.recordSuccessfulLogin(authenticatedAt);
        return account;
    }
}
