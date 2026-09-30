package gt.nexo.commerce.shared.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordEncoderTest {
    @Test
    void storesAnAdaptiveHashAndVerifiesTheOriginalPassword() {
        PasswordEncoder encoder = new SecurityConfiguration().passwordEncoder();
        String rawPassword = "temporary-verification-secret";
        String encoded = encoder.encode(rawPassword);

        assertTrue(encoded.startsWith("{bcrypt}"));
        assertFalse(encoded.contains(rawPassword));
        assertTrue(encoder.matches(rawPassword, encoded));
        assertFalse(encoder.matches("different-secret", encoded));
    }
}
