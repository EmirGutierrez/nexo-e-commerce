package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PasswordPolicyTest {
    @Test
    void acceptsAtMostSeventyTwoUtf8BytesRatherThanCharacters() {
        assertTrue(PasswordPolicy.isWithinBcryptLimit("a".repeat(72)));
        assertFalse(PasswordPolicy.isWithinBcryptLimit("a".repeat(73)));
        assertTrue(PasswordPolicy.isWithinBcryptLimit("😀".repeat(18)));
        assertFalse(PasswordPolicy.isWithinBcryptLimit("😀".repeat(19)));
        assertFalse(PasswordPolicy.isWithinBcryptLimit(null));
    }
}
