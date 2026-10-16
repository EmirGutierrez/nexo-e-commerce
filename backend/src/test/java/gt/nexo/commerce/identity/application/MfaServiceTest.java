package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class MfaServiceTest {
    @Test
    void generatesRfc6238Sha1TotpCodes() {
        byte[] secret = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

        assertEquals("287082", MfaService.totpCode(secret, 1));
        assertEquals(1, MfaService.matchingTotpStep(secret, "287082", 59, -1));
    }

    @Test
    void rejectsReplayedCodesAndMalformedInput() {
        byte[] secret = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

        assertEquals(-1, MfaService.matchingTotpStep(secret, "287082", 59, 1));
        assertEquals(-1, MfaService.matchingTotpStep(secret, "28A082", 59, -1));
    }

    @Test
    void base32SecretRoundTripsWithoutPadding() {
        byte[] secret = "NEXO MFA secret".getBytes(StandardCharsets.US_ASCII);

        String encoded = MfaService.encodeBase32(secret);

        assertNotEquals(0, encoded.length());
        org.junit.jupiter.api.Assertions.assertArrayEquals(secret, MfaService.decodeBase32(encoded));
    }
}
