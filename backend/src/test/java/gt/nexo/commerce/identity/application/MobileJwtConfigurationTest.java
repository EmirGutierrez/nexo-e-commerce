package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;

class MobileJwtConfigurationTest {
    private static final String TEST_KEY = Base64.getEncoder().encodeToString(
            "01234567890123456789012345678901".getBytes(StandardCharsets.US_ASCII));

    private final MobileJwtConfiguration configuration = new MobileJwtConfiguration();
    private final SecretKey key = configuration.mobileJwtSecretKey(
            new MockEnvironment().withProperty("MOBILE_JWT_SECRET", TEST_KEY));
    private final JwtEncoder encoder = configuration.mobileJwtEncoder(key);
    private final JwtDecoder decoder = configuration.mobileJwtDecoder(key);

    @Test
    void acceptsOnlyAConfiguredBase64KeyOfExactly32Bytes() {
        assertEquals(32, key.getEncoded().length);
        assertThrows(IllegalStateException.class,
                () -> configuration.mobileJwtSecretKey(new MockEnvironment()));
        assertThrows(IllegalStateException.class,
                () -> configuration.mobileJwtSecretKey(new MockEnvironment()
                        .withProperty("MOBILE_JWT_SECRET", "not-base64")));
        assertThrows(IllegalStateException.class,
                () -> configuration.mobileJwtSecretKey(new MockEnvironment()
                        .withProperty("MOBILE_JWT_SECRET", Base64.getEncoder().encodeToString(new byte[16]))));
        assertThrows(IllegalStateException.class,
                () -> configuration.mobileJwtSecretKey(new MockEnvironment()
                        .withProperty("MOBILE_JWT_SECRET", Base64.getEncoder().encodeToString(new byte[64]))));
    }

    @Test
    void acceptsASignedTokenForTheMobileIssuerAndAudience() {
        var jwt = decoder.decode(token(claims -> { }));

        assertEquals("HS256", jwt.getHeaders().get("alg"));
        assertEquals("JWT", jwt.getHeaders().get("typ"));
        assertEquals(MobileJwtConfiguration.ISSUER, jwt.getClaimAsString("iss"));
        assertEquals(List.of(MobileJwtConfiguration.AUDIENCE), jwt.getAudience());
    }

    @ParameterizedTest
    @ValueSource(strings = { "iss", "aud", "sub", "jti", "iat", "exp" })
    void rejectsSignedTokensMissingRequiredClaims(String claim) {
        String token = token(builder -> builder.claims(claims -> claims.remove(claim)));

        assertThrows(JwtException.class, () -> decoder.decode(token));
    }

    @ParameterizedTest
    @ValueSource(strings = { "issuer", "audience", "subject", "id", "issuedAt", "expired" })
    void rejectsSignedTokensWithInvalidClaimValues(String invalidClaim) {
        String token = token(builder -> {
            switch (invalidClaim) {
                case "issuer" -> builder.issuer("another-issuer");
                case "audience" -> builder.audience(List.of("another-client"));
                case "subject" -> builder.subject("not-a-user-uuid");
                case "id" -> builder.id("not-a-token-uuid");
                case "issuedAt" -> builder.issuedAt(Instant.now().plusSeconds(120));
                case "expired" -> builder.issuedAt(Instant.now().minusSeconds(600))
                        .expiresAt(Instant.now().minusSeconds(120));
                default -> throw new IllegalArgumentException("Unknown test claim.");
            }
        });

        assertThrows(JwtException.class, () -> decoder.decode(token));
    }

    @Test
    void rejectsTamperedSignatures() {
        String[] segments = token(claims -> { }).split("[.]");
        segments[2] = (segments[2].charAt(0) == 'A' ? "B" : "A") + segments[2].substring(1);
        String tampered = String.join(".", segments);

        assertThrows(JwtException.class, () -> decoder.decode(tampered));
    }

    @Test
    void rejectsUnsignedAndUnsupportedAlgorithmTokens() throws Exception {
        JWTClaimsSet claims = SignedJWT.parse(token(builder -> { })).getJWTClaimsSet();
        String unsigned = new PlainJWT(claims).serialize();
        SignedJWT hs512 = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.HS512).type(JOSEObjectType.JWT).build(), claims);
        hs512.sign(new MACSigner(new byte[64]));

        assertThrows(JwtException.class, () -> decoder.decode(unsigned));
        assertThrows(JwtException.class, () -> decoder.decode(hs512.serialize()));
    }

    private String token(Consumer<JwtClaimsSet.Builder> change) {
        JwtClaimsSet.Builder claims = validClaims();
        change.accept(claims);
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        return encoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
    }

    private JwtClaimsSet.Builder validClaims() {
        Instant now = Instant.now();
        return JwtClaimsSet.builder()
                .issuer(MobileJwtConfiguration.ISSUER)
                .audience(List.of(MobileJwtConfiguration.AUDIENCE))
                .subject(UUID.randomUUID().toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(now)
                .expiresAt(now.plusSeconds(600));
    }
}
