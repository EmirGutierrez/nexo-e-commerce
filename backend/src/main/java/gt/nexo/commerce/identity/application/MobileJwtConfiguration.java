package gt.nexo.commerce.identity.application;

import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.jwk.source.JWKSource;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

@Configuration(proxyBeanMethods = false)
public class MobileJwtConfiguration {
    public static final String ISSUER = "nexo-commerce";
    public static final String AUDIENCE = "nexo-commerce-mobile";

    @Bean
    SecretKey mobileJwtSecretKey(Environment environment) {
        String encodedSecret = environment.getProperty("MOBILE_JWT_SECRET", "");
        if (encodedSecret.isBlank()) {
            throw new IllegalStateException("MOBILE_JWT_SECRET must contain a Base64-encoded 32-byte key.");
        }

        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(encodedSecret);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("MOBILE_JWT_SECRET must contain a Base64-encoded 32-byte key.", exception);
        }
        if (keyBytes.length != 32) {
            throw new IllegalStateException("MOBILE_JWT_SECRET must contain a Base64-encoded 32-byte key.");
        }
        return new SecretKeySpec(keyBytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder mobileJwtEncoder(SecretKey mobileJwtSecretKey) {
        JWKSource<SecurityContext> source = new ImmutableSecret<>(mobileJwtSecretKey);
        return new NimbusJwtEncoder(source);
    }

    @Bean
    JwtDecoder mobileJwtDecoder(SecretKey mobileJwtSecretKey) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(mobileJwtSecretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        OAuth2TokenValidator<Jwt> requiredMobileClaims = jwt -> {
            Instant issuedAt = jwt.getIssuedAt();
            Instant expiresAt = jwt.getExpiresAt();
            List<String> audience = jwt.getAudience();
            boolean valid = ISSUER.equals(jwt.getClaimAsString("iss"))
                    && audience != null
                    && audience.contains(AUDIENCE)
                    && isUuid(jwt.getSubject())
                    && isUuid(jwt.getId())
                    && issuedAt != null
                    && expiresAt != null
                    && expiresAt.isAfter(issuedAt)
                    && !issuedAt.isAfter(Instant.now().plusSeconds(30));
            if (valid) return OAuth2TokenValidatorResult.success();
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN, "Invalid mobile JWT claims.", null));
        };
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(),
                requiredMobileClaims));
        return decoder;
    }

    private static boolean isUuid(String value) {
        if (value == null || value.isBlank()) return false;
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
