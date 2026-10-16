package gt.nexo.commerce.identity.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.api.dto.MfaEnrollmentResponse;
import gt.nexo.commerce.identity.api.dto.MfaStatusResponse;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.shared.errors.InvalidCredentialsException;
import java.lang.reflect.Constructor;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.password.PasswordEncoder;

class MfaServiceLifecycleTest {
    private static final UUID USER_ID = UUID.fromString("ce977e99-1957-49a5-a47d-c056af457ad4");
    private static final UUID RECOVERY_ID = UUID.fromString("8762ec63-035b-460c-8e91-700d8d52fb88");
    private static final String PASSWORD = "correct-password";
    private static final String PASSWORD_HASH = "{bcrypt}stored-hash";
    private static final byte[] KEY = new byte[32];
    private static final String ENCODED_KEY = Base64.getEncoder().encodeToString(KEY);

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final MfaService service = new MfaService(jdbc, users, passwordEncoder, ENCODED_KEY);

    @Test
    void returnsTheCurrentMfaStatusAndRecoveryCount() {
        doAnswer(invocation -> {
            ResultSet result = mock(ResultSet.class);
            when(result.next()).thenReturn(true);
            when(result.getBoolean(1)).thenReturn(true);
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            return extractor.extractData(result);
        }).when(jdbc).query(contains("SELECT enabled_at IS NOT NULL FROM app_user_mfa"),
                any(ResultSetExtractor.class), any(Object[].class));
        when(jdbc.queryForObject(contains("COUNT(*)"), eq(Integer.class), any(Object[].class))).thenReturn(4);

        MfaStatusResponse status = service.status(USER_ID);

        assertTrue(status.enabled());
        assertFalse(status.enrollmentPending());
        assertEquals(4, status.recoveryCodesRemaining());
    }

    @Test
    void beginsEnrollmentOnlyAfterPasswordAndKeyChecksAndReturnsSha1Uri() {
        stubAccount();
        stubEnrollmentState(false);

        MfaEnrollmentResponse enrollment = service.beginEnrollment(USER_ID, "admin@example.com", PASSWORD);

        assertEquals(52, enrollment.secret().length());
        assertTrue(enrollment.otpauthUri().contains("algorithm=SHA1"));
        assertTrue(enrollment.otpauthUri().contains("admin%40example.com"));
        ArgumentCaptor<Object[]> insert = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("INSERT INTO app_user_mfa(user_id"), insert.capture());
        byte[] ciphertext = (byte[]) insert.getValue()[1];
        assertEquals(60, ciphertext.length);
        verify(jdbc).update(contains("DELETE FROM app_user_mfa_recovery_code"), any(Object[].class));
    }

    @Test
    void refusesEnrollmentForWrongPasswordMissingKeyOrAlreadyEnabledAccount() {
        stubAccount();
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(false);
        assertThrows(InvalidCredentialsException.class,
                () -> service.beginEnrollment(USER_ID, "admin@example.com", PASSWORD));
        verifyNoInteractions(jdbc);

        MfaService withoutKey = new MfaService(jdbc, users, passwordEncoder, "");
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
        assertThrows(MfaUnavailableException.class,
                () -> withoutKey.beginEnrollment(USER_ID, "admin@example.com", PASSWORD));
        verifyNoInteractions(jdbc);

        stubEnrollmentState(true);
        assertThrows(BusinessRuleException.class,
                () -> service.beginEnrollment(USER_ID, "admin@example.com", PASSWORD));
    }

    @Test
    void completesEnrollmentAndIssuesTenOneTimeRecoveryCodes() {
        String secret = startEnrollmentAndCaptureSecret();
        stubMfaRecord(ciphertextFromBegin(), null, -1, true);
        String code = currentCode(secret);

        List<String> recoveryCodes = service.completeEnrollment(USER_ID, code);

        assertEquals(10, recoveryCodes.size());
        assertTrue(recoveryCodes.stream().allMatch(value -> value.matches("[A-F0-9]{5}(-[A-F0-9]{5}){3}")));
        assertEquals(10, recoveryCodes.stream().distinct().count());
        verify(jdbc).update(contains("SET enabled_at = NOW()"), any(Object[].class));
        verify(jdbc, org.mockito.Mockito.times(10)).update(contains("INSERT INTO app_user_mfa_recovery_code"), any(Object[].class));
        ArgumentCaptor<Object[]> recoveryInsert = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc, org.mockito.Mockito.times(10)).update(contains("INSERT INTO app_user_mfa_recovery_code"), recoveryInsert.capture());
        assertNotEquals(recoveryCodes.get(0).replace("-", ""), recoveryInsert.getAllValues().get(0)[2]);
    }

    @Test
    void rejectsCompletionWhenEnrollmentIsMissingAlreadyEnabledOrCiphertextWasTampered() {
        stubMfaRecord(null, null, -1, false);
        assertThrows(BusinessRuleException.class, () -> service.completeEnrollment(USER_ID, "000000"));

        stubMfaRecord(null, Timestamp.from(Instant.now()), -1, true);
        assertThrows(BusinessRuleException.class, () -> service.completeEnrollment(USER_ID, "000000"));

        String secret = startEnrollmentAndCaptureSecret();
        byte[] tampered = ciphertextFromBegin();
        tampered[tampered.length - 1] ^= 1;
        stubMfaRecord(tampered, null, -1, true);
        assertThrows(MfaUnavailableException.class, () -> service.completeEnrollment(USER_ID, currentCode(secret)));
    }

    @Test
    void skipsUnenrolledAccountsAndRejectsMissingOrInvalidSecondFactors() {
        stubMfaRecord(null, null, -1, false);
        service.verifyLogin(USER_ID, null);
        verify(jdbc, never()).update(anyString(), any(Object[].class));

        String secret = startEnrollmentAndCaptureSecret();
        stubMfaRecord(ciphertextFromBegin(), Timestamp.from(Instant.now()), -1, true);
        MfaChallengeException required = assertThrows(MfaChallengeException.class, () -> service.verifyLogin(USER_ID, " "));
        assertEquals("MFA_REQUIRED", required.getCode());
        MfaChallengeException invalid = assertThrows(MfaChallengeException.class, () -> service.verifyLogin(USER_ID, "000000"));
        assertEquals("MFA_INVALID", invalid.getCode());
        stubRecoveryCode(RECOVERY_ID, "00".repeat(32));
        MfaChallengeException invalidRecovery = assertThrows(MfaChallengeException.class,
                () -> service.verifyLogin(USER_ID, "00000-00000-00000-00000"));
        assertEquals("MFA_INVALID", invalidRecovery.getCode());
        assertNotEquals("000000", currentCode(secret));
    }

    @Test
    void acceptsTotpAndRejectsItsReplay() {
        String secret = startEnrollmentAndCaptureSecret();
        byte[] ciphertext = ciphertextFromBegin();
        long step = Instant.now().getEpochSecond() / 30;
        String code = MfaService.totpCode(MfaService.decodeBase32(secret), step);
        stubMfaRecord(ciphertext, Timestamp.from(Instant.now()), -1, true);

        service.verifyLogin(USER_ID, code);

        verify(jdbc).update(contains("SET last_used_step = ?"), any(Object[].class));
        stubMfaRecord(ciphertext, Timestamp.from(Instant.now()), step, true);
        assertThrows(MfaChallengeException.class, () -> service.verifyLogin(USER_ID, code));
    }

    @Test
    void consumesRecoveryCodesOnceDuringLogin() {
        String secret = startEnrollmentAndCaptureSecret();
        stubMfaRecord(ciphertextFromBegin(), null, -1, true);
        List<String> codes = service.completeEnrollment(USER_ID, currentCode(secret));
        ArgumentCaptor<Object[]> inserted = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc, org.mockito.Mockito.times(10)).update(contains("INSERT INTO app_user_mfa_recovery_code"), inserted.capture());
        String storedHash = String.valueOf(inserted.getAllValues().get(0)[2]);
        stubMfaRecord(ciphertextFromBegin(), Timestamp.from(Instant.now()), 1, true);
        stubRecoveryCode(RECOVERY_ID, storedHash);

        service.verifyLogin(USER_ID, codes.get(0).replace("-", "").toLowerCase());

        verify(jdbc).update(contains("DELETE FROM app_user_mfa_recovery_code WHERE id"), eq(RECOVERY_ID));
    }

    @Test
    void disablesMfaAndRotatesCodesAfterPasswordAndTotpVerification() {
        String secret = startEnrollmentAndCaptureSecret();
        byte[] ciphertext = ciphertextFromBegin();
        stubMfaRecord(ciphertext, Timestamp.from(Instant.now()), -1, true);
        String code = currentCode(secret);

        service.disable(USER_ID, PASSWORD, code);

        verify(jdbc).update(contains("DELETE FROM app_user_mfa WHERE user_id"), eq(USER_ID));

        stubMfaRecord(ciphertext, Timestamp.from(Instant.now()), -1, true);
        List<String> rotated = service.rotateRecoveryCodes(USER_ID, PASSWORD, currentCode(secret));

        assertEquals(10, rotated.size());
        verify(jdbc, org.mockito.Mockito.times(2)).update(contains("DELETE FROM app_user_mfa_recovery_code WHERE user_id"), eq(USER_ID));
    }

    @Test
    void rotatesRecoveryCodesAfterConsumingAnExistingRecoveryCode() {
        String secret = startEnrollmentAndCaptureSecret();
        byte[] ciphertext = ciphertextFromBegin();
        stubMfaRecord(ciphertext, null, -1, true);
        List<String> originalCodes = service.completeEnrollment(USER_ID, currentCode(secret));
        ArgumentCaptor<Object[]> inserts = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc, org.mockito.Mockito.times(10)).update(contains("INSERT INTO app_user_mfa_recovery_code"), inserts.capture());
        stubMfaRecord(ciphertext, Timestamp.from(Instant.now()), 1, true);
        stubRecoveryCode(RECOVERY_ID, String.valueOf(inserts.getAllValues().get(0)[2]));

        List<String> rotatedCodes = service.rotateRecoveryCodes(USER_ID, PASSWORD, originalCodes.get(0));

        assertEquals(10, rotatedCodes.size());
        assertNotEquals(originalCodes, rotatedCodes);
        verify(jdbc).update(contains("DELETE FROM app_user_mfa_recovery_code WHERE id"), eq(RECOVERY_ID));
    }

    @Test
    void mfaRecordUsesCiphertextContentForEqualityAndHashAndRedactsItInText() throws Exception {
        Class<?> type = Class.forName("gt.nexo.commerce.identity.application.MfaService$MfaRecord");
        Constructor<?> constructor = type.getDeclaredConstructor(byte[].class, Instant.class, long.class);
        constructor.setAccessible(true);
        Object first = constructor.newInstance(new byte[] {1, 2, 3}, Instant.EPOCH, 7L);
        Object same = constructor.newInstance(new byte[] {1, 2, 3}, Instant.EPOCH, 7L);
        Object different = constructor.newInstance(new byte[] {3, 2, 1}, Instant.EPOCH, 7L);

        assertEquals(first, same);
        assertEquals(first.hashCode(), same.hashCode());
        assertNotEquals(first, different);
        assertTrue(first.toString().contains("ciphertext=<redacted>"));
    }

    @Test
    void requiresAnEnabledAccountAndValidPasswordForManagementOperations() {
        stubAccount();
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(false);
        assertThrows(InvalidCredentialsException.class, () -> service.disable(USER_ID, PASSWORD, "123456"));
        assertThrows(InvalidCredentialsException.class, () -> service.rotateRecoveryCodes(USER_ID, PASSWORD, "123456"));

        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
        stubMfaRecord(null, null, -1, false);
        assertThrows(BusinessRuleException.class, () -> service.disable(USER_ID, PASSWORD, "123456"));
        assertThrows(BusinessRuleException.class, () -> service.rotateRecoveryCodes(USER_ID, PASSWORD, "123456"));
    }

    private AppUserEntity stubAccount() {
        AppUserEntity account = mock(AppUserEntity.class);
        when(users.findById(USER_ID)).thenReturn(Optional.of(account));
        when(account.getPasswordHash()).thenReturn(PASSWORD_HASH);
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
        return account;
    }

    private void stubEnrollmentState(boolean enabled) {
        doAnswer(invocation -> {
            ResultSet result = mock(ResultSet.class);
            when(result.next()).thenReturn(enabled);
            when(result.getBoolean(1)).thenReturn(enabled);
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            return extractor.extractData(result);
        }).when(jdbc).query(contains("FOR UPDATE"), any(ResultSetExtractor.class), any(Object[].class));
    }

    private void stubMfaRecord(byte[] ciphertext, Timestamp enabledAt, long lastUsedStep, boolean found) {
        doAnswer(invocation -> {
            if (!found) return List.of();
            ResultSet result = mock(ResultSet.class);
            when(result.getBytes("secret_ciphertext")).thenReturn(ciphertext);
            when(result.getTimestamp("enabled_at")).thenReturn(enabledAt);
            when(result.getLong("last_used_step")).thenReturn(lastUsedStep);
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(result, 0));
        }).when(jdbc).query(contains("FROM app_user_mfa WHERE user_id = ? FOR UPDATE"),
                any(RowMapper.class), any(Object[].class));
    }

    private void stubRecoveryCode(UUID id, String hash) {
        doAnswer(invocation -> {
            ResultSet result = mock(ResultSet.class);
            when(result.getObject("id", UUID.class)).thenReturn(id);
            when(result.getString("code_hash")).thenReturn(hash);
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(result, 0));
        }).when(jdbc).query(contains("SELECT id, code_hash"), any(RowMapper.class), any(Object[].class));
    }

    private String startEnrollmentAndCaptureSecret() {
        stubAccount();
        stubEnrollmentState(false);
        return service.beginEnrollment(USER_ID, "admin@example.com", PASSWORD).secret();
    }

    private byte[] ciphertextFromBegin() {
        ArgumentCaptor<Object[]> insert = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("INSERT INTO app_user_mfa(user_id"), insert.capture());
        return (byte[]) insert.getValue()[1];
    }

    private static String currentCode(String encodedSecret) {
        long step = Instant.now().getEpochSecond() / 30;
        return MfaService.totpCode(MfaService.decodeBase32(encodedSecret), step);
    }
}
