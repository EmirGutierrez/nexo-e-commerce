package gt.nexo.commerce.identity.application;

import java.nio.charset.StandardCharsets;

/** Enforces the input limit of the configured BCrypt password encoder. */
public final class PasswordPolicy {
    private static final int BCRYPT_MAX_INPUT_BYTES = 72;

    private PasswordPolicy() { }

    public static boolean isWithinBcryptLimit(String password) {
        return password != null && password.getBytes(StandardCharsets.UTF_8).length <= BCRYPT_MAX_INPUT_BYTES;
    }
}
