package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.MobileAccessTokenEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.MobileAccessTokenRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MobileSessionService {
    private static final int RAW_TOKEN_BYTES = 32;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final MobileAccessTokenRepository tokens;
    private final Duration tokenLifetime;

    public MobileSessionService(MobileAccessTokenRepository tokens,
                                @Value("${nexo.mobile.access-token-lifetime:7d}") Duration tokenLifetime) {
        if (tokenLifetime.isZero() || tokenLifetime.isNegative()) {
            throw new IllegalArgumentException("The mobile access token lifetime must be positive.");
        }
        this.tokens = tokens;
        this.tokenLifetime = tokenLifetime;
    }

    @Transactional
    public IssuedToken issue(AppUserEntity user) {
        Instant createdAt = Instant.now();
        Instant expiresAt = createdAt.plus(tokenLifetime);
        byte[] bytes = new byte[RAW_TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        String accessToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String tokenHash = hash(accessToken);

        tokens.deleteExpiredBefore(createdAt);
        tokens.save(new MobileAccessTokenEntity(tokenHash, user, createdAt, expiresAt));
        return new IssuedToken(accessToken, expiresAt);
    }

    @Transactional
    public Optional<Authentication> authenticate(String rawToken) {
        if (!isWellFormedToken(rawToken)) return Optional.empty();

        String tokenHash = hash(rawToken);
        Optional<MobileAccessTokenEntity> storedToken = tokens.findByTokenHash(tokenHash);
        if (storedToken.isEmpty()) return Optional.empty();

        Instant now = Instant.now();
        MobileAccessTokenEntity token = storedToken.get();
        AppUserEntity user = token.getUser();
        if (!token.getExpiresAt().isAfter(now)
                || user.getStatus() != UserStatus.ACTIVE
                || user.isCurrentlyLocked(now)) {
            tokens.deleteByTokenHash(tokenHash);
            return Optional.empty();
        }

        NexoUserPrincipal principal = NexoUserPrincipal.from(user);
        UsernamePasswordAuthenticationToken authentication = UsernamePasswordAuthenticationToken.authenticated(
                principal, null, principal.getAuthorities());
        authentication.setDetails(new MobileTokenAuthenticationDetails(tokenHash));
        return Optional.of(authentication);
    }

    @Transactional
    public void revoke(Authentication authentication) {
        if (!(authentication.getDetails() instanceof MobileTokenAuthenticationDetails details)) {
            throw new AccessDeniedException("A mobile access token is required to close this session.");
        }
        tokens.deleteByTokenHash(details.tokenHash());
    }

    private static boolean isWellFormedToken(String token) {
        return token != null && token.length() == 43 && token.matches("[A-Za-z0-9_-]{43}");
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    public record IssuedToken(String accessToken, Instant expiresAt) {
    }
}
