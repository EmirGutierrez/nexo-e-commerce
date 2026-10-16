package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.api.dto.MfaEnrollmentResponse;
import gt.nexo.commerce.identity.api.dto.MfaStatusResponse;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.shared.errors.InvalidCredentialsException;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MfaService {
    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final int TOTP_PERIOD_SECONDS = 30;
    private static final int RECOVERY_CODE_COUNT = 10;
    private static final SecureRandom RANDOM = new SecureRandom();
    private final JdbcTemplate jdbc;
    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String encryptionKey;

    public MfaService(JdbcTemplate jdbc, AppUserRepository users, PasswordEncoder passwordEncoder,
                      @Value("${nexo.security.mfa.encryption-key:}") String encryptionKey) {
        this.jdbc = jdbc;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.encryptionKey = encryptionKey;
    }

    @Transactional(readOnly = true)
    public MfaStatusResponse status(UUID userId) {
        Optional<Boolean> enabled = jdbc.query(
                "SELECT enabled_at IS NOT NULL FROM app_user_mfa WHERE user_id = ?",
                rs -> rs.next() ? Optional.of(rs.getBoolean(1)) : Optional.empty(), userId);
        int remaining = jdbc.queryForObject(
                "SELECT COUNT(*) FROM app_user_mfa_recovery_code WHERE user_id = ?", Integer.class, userId);
        return new MfaStatusResponse(enabled.orElse(false), enabled.isPresent() && !enabled.get(), remaining);
    }

    @Transactional
    public MfaEnrollmentResponse beginEnrollment(UUID userId, String email, String currentPassword) {
        AppUserEntity account = users.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException());
        if (!passwordEncoder.matches(currentPassword, account.getPasswordHash())) throw new InvalidCredentialsException();
        requireEncryptionKey();
        boolean enabled = jdbc.query(
                "SELECT enabled_at IS NOT NULL FROM app_user_mfa WHERE user_id = ? FOR UPDATE",
                rs -> rs.next() && rs.getBoolean(1), userId);
        if (enabled) {
            throw new BusinessRuleException(HttpStatus.CONFLICT, "MFA_ALREADY_ENABLED",
                    "Desactiva la verificación en dos pasos antes de volver a configurarla.");
        }

        byte[] rawSecret = new byte[20];
        RANDOM.nextBytes(rawSecret);
        String secret = encodeBase32(rawSecret);
        byte[] ciphertext = encryptSecret(userId, rawSecret);
        jdbc.update("""
                INSERT INTO app_user_mfa(user_id, secret_ciphertext, enabled_at, last_used_step, created_at, updated_at)
                VALUES (?, ?, NULL, -1, NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE
                SET secret_ciphertext = EXCLUDED.secret_ciphertext, enabled_at = NULL,
                    last_used_step = -1, updated_at = NOW()
                """, userId, ciphertext);
        jdbc.update("DELETE FROM app_user_mfa_recovery_code WHERE user_id = ?", userId);

        String issuer = URLEncoder.encode("NEXO Commerce", StandardCharsets.UTF_8);
        String accountLabel = URLEncoder.encode(email, StandardCharsets.UTF_8);
        String uri = "otpauth://totp/" + issuer + ":" + accountLabel + "?secret=" + secret
                + "&issuer=" + issuer + "&algorithm=SHA1&digits=6&period=30";
        return new MfaEnrollmentResponse(secret, uri);
    }

    @Transactional
    public List<String> completeEnrollment(UUID userId, String code) {
        MfaRecord record = lockRecord(userId)
                .orElseThrow(() -> new BusinessRuleException(HttpStatus.CONFLICT, "MFA_ENROLLMENT_NOT_STARTED",
                        "Inicia la configuración de verificación en dos pasos antes de confirmarla."));
        if (record.enabledAt() != null) {
            throw new BusinessRuleException(HttpStatus.CONFLICT, "MFA_ALREADY_ENABLED", "La verificación en dos pasos ya está activa.");
        }
        byte[] secret = decryptSecret(userId, record.ciphertext());
        long matchedStep = matchingTotpStep(secret, code, Instant.now().getEpochSecond(), record.lastUsedStep());
        if (matchedStep < 0) throw MfaChallengeException.invalid();

        jdbc.update("UPDATE app_user_mfa SET enabled_at = NOW(), last_used_step = ?, updated_at = NOW() WHERE user_id = ?",
                matchedStep, userId);
        jdbc.update("DELETE FROM app_user_mfa_recovery_code WHERE user_id = ?", userId);
        return issueRecoveryCodes(userId);
    }

    @Transactional
    public void verifyLogin(UUID userId, String code) {
        Optional<MfaRecord> optionalRecord = lockRecord(userId);
        if (optionalRecord.isEmpty() || optionalRecord.get().enabledAt() == null) return;
        MfaRecord record = optionalRecord.get();
        if (code == null || code.isBlank()) throw MfaChallengeException.required();

        byte[] normalizedRecovery = normalizeRecoveryCode(code);
        if (normalizedRecovery != null) {
            byte[] candidateHash = recoveryCodeHash(normalizedRecovery);
            List<RecoveryCode> recoveryCodes = jdbc.query(
                    "SELECT id, code_hash FROM app_user_mfa_recovery_code WHERE user_id = ?",
                    (rs, row) -> new RecoveryCode(rs.getObject("id", UUID.class), rs.getString("code_hash")), userId);
            for (RecoveryCode recovery : recoveryCodes) {
                if (MessageDigest.isEqual(candidateHash, HexFormat.of().parseHex(recovery.hash()))) {
                    jdbc.update("DELETE FROM app_user_mfa_recovery_code WHERE id = ?", recovery.id());
                    return;
                }
            }
        }

        long matchedStep = matchingTotpStep(decryptSecret(userId, record.ciphertext()), code,
                Instant.now().getEpochSecond(), record.lastUsedStep());
        if (matchedStep < 0) throw MfaChallengeException.invalid();
        jdbc.update("UPDATE app_user_mfa SET last_used_step = ?, updated_at = NOW() WHERE user_id = ?", matchedStep, userId);
    }

    @Transactional
    public void disable(UUID userId, String currentPassword, String code) {
        AppUserEntity account = users.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException());
        if (!passwordEncoder.matches(currentPassword, account.getPasswordHash())) throw new InvalidCredentialsException();
        MfaRecord record = lockRecord(userId)
                .filter(value -> value.enabledAt() != null)
                .orElseThrow(() -> new BusinessRuleException(HttpStatus.CONFLICT, "MFA_NOT_ENABLED",
                        "La verificación en dos pasos no está activa."));
        consumeManagementCode(userId, record, code);
        jdbc.update("DELETE FROM app_user_mfa WHERE user_id = ?", userId);
    }

    @Transactional
    public List<String> rotateRecoveryCodes(UUID userId, String currentPassword, String code) {
        AppUserEntity account = users.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException());
        if (!passwordEncoder.matches(currentPassword, account.getPasswordHash())) throw new InvalidCredentialsException();
        MfaRecord record = lockRecord(userId)
                .filter(value -> value.enabledAt() != null)
                .orElseThrow(() -> new BusinessRuleException(HttpStatus.CONFLICT, "MFA_NOT_ENABLED",
                        "Activa la verificación en dos pasos antes de generar códigos de recuperación."));
        consumeManagementCode(userId, record, code);
        jdbc.update("DELETE FROM app_user_mfa_recovery_code WHERE user_id = ?", userId);
        return issueRecoveryCodes(userId);
    }

    private void consumeManagementCode(UUID userId, MfaRecord record, String code) {
        byte[] normalizedRecovery = normalizeRecoveryCode(code);
        if (normalizedRecovery != null) {
            byte[] candidateHash = recoveryCodeHash(normalizedRecovery);
            List<RecoveryCode> recoveryCodes = jdbc.query(
                    "SELECT id, code_hash FROM app_user_mfa_recovery_code WHERE user_id = ?",
                    (rs, row) -> new RecoveryCode(rs.getObject("id", UUID.class), rs.getString("code_hash")), userId);
            for (RecoveryCode recovery : recoveryCodes) {
                if (MessageDigest.isEqual(candidateHash, HexFormat.of().parseHex(recovery.hash()))) {
                    jdbc.update("DELETE FROM app_user_mfa_recovery_code WHERE id = ?", recovery.id());
                    return;
                }
            }
        }
        long matchedStep = matchingTotpStep(decryptSecret(userId, record.ciphertext()), code,
                Instant.now().getEpochSecond(), record.lastUsedStep());
        if (matchedStep < 0) throw MfaChallengeException.invalid();
        jdbc.update("UPDATE app_user_mfa SET last_used_step = ?, updated_at = NOW() WHERE user_id = ?", matchedStep, userId);
    }

    private List<String> issueRecoveryCodes(UUID userId) {
        List<String> recoveryCodes = new ArrayList<>(RECOVERY_CODE_COUNT);
        for (int index = 0; index < RECOVERY_CODE_COUNT; index++) {
            String codeValue = HexFormat.of().withUpperCase().formatHex(randomBytes(10));
            recoveryCodes.add(groupRecoveryCode(codeValue));
            jdbc.update("INSERT INTO app_user_mfa_recovery_code(id, user_id, code_hash, created_at) VALUES (?, ?, ?, NOW())",
                    UUID.randomUUID(), userId, recoveryCodeHash(codeValue));
        }
        return List.copyOf(recoveryCodes);
    }

    private Optional<MfaRecord> lockRecord(UUID userId) {
        return jdbc.query("""
                SELECT secret_ciphertext, enabled_at, last_used_step
                FROM app_user_mfa WHERE user_id = ? FOR UPDATE
                """, (rs, row) -> new MfaRecord(rs.getBytes("secret_ciphertext"),
                rs.getTimestamp("enabled_at") == null ? null : rs.getTimestamp("enabled_at").toInstant(),
                rs.getLong("last_used_step")), userId).stream().findFirst();
    }

    private byte[] encryptionKeyBytes() {
        try {
            byte[] key = Base64.getDecoder().decode(encryptionKey.trim());
            if (key.length != 32) throw new IllegalArgumentException();
            return key;
        } catch (IllegalArgumentException exception) {
            throw new MfaUnavailableException();
        }
    }

    private void requireEncryptionKey() { encryptionKeyBytes(); }

    private byte[] encryptSecret(UUID userId, byte[] secret) {
        try {
            byte[] nonce = randomBytes(12);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(encryptionKeyBytes(), "AES"), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(userId.toString().getBytes(StandardCharsets.US_ASCII));
            byte[] encrypted = cipher.doFinal(secret);
            return ByteBuffer.allocate(nonce.length + encrypted.length).put(nonce).put(encrypted).array();
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("No se pudo proteger el secreto MFA.", exception);
        }
    }

    private byte[] decryptSecret(UUID userId, byte[] ciphertext) {
        try {
            if (ciphertext.length < 29) throw new GeneralSecurityException("Invalid encrypted secret");
            ByteBuffer buffer = ByteBuffer.wrap(ciphertext);
            byte[] nonce = new byte[12];
            buffer.get(nonce);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(encryptionKeyBytes(), "AES"), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(userId.toString().getBytes(StandardCharsets.US_ASCII));
            return cipher.doFinal(encrypted);
        } catch (GeneralSecurityException exception) {
            throw new MfaUnavailableException();
        }
    }

    static long matchingTotpStep(byte[] secret, String code, long nowEpochSeconds, long lastUsedStep) {
        if (code == null || !code.matches("\\d{6}")) return -1;
        long currentStep = nowEpochSeconds / TOTP_PERIOD_SECONDS;
        byte[] supplied = code.getBytes(StandardCharsets.US_ASCII);
        for (long step = currentStep - 1; step <= currentStep + 1; step++) {
            if (step <= lastUsedStep || step < 0) continue;
            if (MessageDigest.isEqual(supplied, totpCode(secret, step).getBytes(StandardCharsets.US_ASCII))) return step;
        }
        return -1;
    }

    static String totpCode(byte[] secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret, "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(Long.BYTES).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
            return String.format(Locale.ROOT, "%06d", binary % 1_000_000);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("No se pudo calcular el código MFA.", exception);
        }
    }

    static String encodeBase32(byte[] bytes) {
        StringBuilder result = new StringBuilder((bytes.length * 8 + 4) / 5);
        int buffer = 0;
        int bits = 0;
        for (byte value : bytes) {
            buffer = (buffer << 8) | (value & 0xff);
            bits += 8;
            while (bits >= 5) {
                result.append(BASE32_ALPHABET.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) result.append(BASE32_ALPHABET.charAt((buffer << (5 - bits)) & 31));
        return result.toString();
    }

    static byte[] decodeBase32(String value) {
        String normalized = value.replace("=", "").replace(" ", "").toUpperCase(Locale.ROOT);
        byte[] result = new byte[normalized.length() * 5 / 8];
        int buffer = 0;
        int bits = 0;
        int index = 0;
        for (char character : normalized.toCharArray()) {
            int digit = BASE32_ALPHABET.indexOf(character);
            if (digit < 0) throw new IllegalArgumentException("Invalid base32 value");
            buffer = (buffer << 5) | digit;
            bits += 5;
            if (bits >= 8) {
                result[index++] = (byte) ((buffer >> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return result;
    }

    private static byte[] normalizeRecoveryCode(String code) {
        if (code == null) return null;
        String normalized = code.replace("-", "").replace(" ", "").trim().toUpperCase(Locale.ROOT);
        return normalized.matches("[0-9A-F]{20}") ? normalized.getBytes(StandardCharsets.US_ASCII) : null;
    }

    private static String recoveryCodeHash(String code) {
        return HexFormat.of().formatHex(recoveryCodeHash(code.getBytes(StandardCharsets.US_ASCII)));
    }

    private static byte[] recoveryCodeHash(byte[] code) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(code);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("No se pudo proteger el código de recuperación.", exception);
        }
    }

    private static String groupRecoveryCode(String value) {
        return value.substring(0, 5) + "-" + value.substring(5, 10) + "-"
                + value.substring(10, 15) + "-" + value.substring(15);
    }

    private static byte[] randomBytes(int size) {
        byte[] bytes = new byte[size];
        RANDOM.nextBytes(bytes);
        return bytes;
    }

    private record MfaRecord(byte[] ciphertext, Instant enabledAt, long lastUsedStep) { }
    private record RecoveryCode(UUID id, String hash) { }
}
