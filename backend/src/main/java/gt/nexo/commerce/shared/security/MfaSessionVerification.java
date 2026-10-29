package gt.nexo.commerce.shared.security;

import jakarta.servlet.http.HttpSession;
import java.util.UUID;

/** Stores only which account passed its second factor in this server-side session. */
public final class MfaSessionVerification {
    public static final String VERIFIED_USER_ATTRIBUTE = "nexo.mfa-verified-user";

    private MfaSessionVerification() { }

    public static void markVerified(HttpSession session, UUID userId) {
        if (session != null) session.setAttribute(VERIFIED_USER_ATTRIBUTE, userId.toString());
    }

    public static boolean isVerified(HttpSession session, UUID userId) {
        return session != null && userId.toString().equals(session.getAttribute(VERIFIED_USER_ATTRIBUTE));
    }
}
