package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.api.dto.LoginRequest;
import gt.nexo.commerce.identity.api.dto.MobileLoginResponse;
import gt.nexo.commerce.shared.errors.InvalidCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MobileAuthenticationService {
    private final AuthenticationService authenticationService;
    private final MobileSessionService mobileSessionService;
    private final UserAccountService userAccountService;

    public MobileAuthenticationService(AuthenticationService authenticationService,
                                       MobileSessionService mobileSessionService,
                                       UserAccountService userAccountService) {
        this.authenticationService = authenticationService;
        this.mobileSessionService = mobileSessionService;
        this.userAccountService = userAccountService;
    }

    @Transactional(noRollbackFor = InvalidCredentialsException.class)
    public MobileLoginResponse login(LoginRequest request) {
        var account = authenticationService.authenticateMobile(request);
        var token = mobileSessionService.issue(account);
        return new MobileLoginResponse(token.accessToken(), "Bearer", token.expiresAt(),
                userAccountService.currentUser(account.getId()));
    }
}
