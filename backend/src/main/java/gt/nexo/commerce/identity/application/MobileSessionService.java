package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.MobileAccessTokenEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.MobileAccessTokenRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MobileSessionService {
    private static final int MAX_TOKEN_LENGTH = 4096;
    private static final String COMPACT_JWT_PATTERN = "[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+";

    private final MobileAccessTokenRepository tokens;
    private final Duration tokenLifetime;
    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;

    public MobileSessionService(MobileAccessTokenRepository tokens,
                                @Value("${nexo.mobile.access-token-lifetime:7d}") Duration tokenLifetime,
                                JwtEncoder jwtEncoder,
                                JwtDecoder jwtDecoder) {
        if (tokenLifetime.isZero() || tokenLifetime.isNegative()) {
            throw new IllegalArgumentException("The mobile access token lifetime must be positive.");
        }
        this.tokens = tokens;
        this.tokenLifetime = tokenLifetime;
        this.jwtEncoder = jwtEncoder;
        this.jwtDecoder = jwtDecoder;
    }

    @Transactional
    public IssuedToken issue(AppUserEntity user) {
        Instant createdAt = Instant.now();
        Instant expiresAt = createdAt.plus(tokenLifetime);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(MobileJwtConfiguration.ISSUER)
                .subject(user.getId().toString())
                .audience(List.of(MobileJwtConfiguration.AUDIENCE))
                .issuedAt(createdAt)
                .expiresAt(expiresAt)
                .id(UUID.randomUUID().toString())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        String accessToken = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        String tokenHash = hash(accessToken);

        tokens.deleteExpiredBefore(createdAt);
        tokens.save(new MobileAccessTokenEntity(tokenHash, user, createdAt, expiresAt));
        return new IssuedToken(accessToken, expiresAt);
    }

    @Transactional
    public Optional<Authentication> authenticate(String rawToken) {
        if (!isWellFormedJwt(rawToken)) return Optional.empty();

        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(rawToken);
        } catch (JwtException | IllegalArgumentException exception) {
            return Optional.empty();
        }

        String tokenHash = hash(rawToken);
        Optional<MobileAccessTokenEntity> storedToken = tokens.findByTokenHash(tokenHash);
        if (storedToken.isEmpty()) return Optional.empty();

        Instant now = Instant.now();
        MobileAccessTokenEntity token = storedToken.get();
        AppUserEntity user = token.getUser();
        UUID subjectId = UUID.fromString(jwt.getSubject());
        if (!user.getId().equals(subjectId)
                || !jwt.getExpiresAt().isAfter(now)
                || !token.getExpiresAt().isAfter(now)
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

    private static boolean isWellFormedJwt(String token) {
        return token != null && token.length() <= MAX_TOKEN_LENGTH && token.matches(COMPACT_JWT_PATTERN);
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
