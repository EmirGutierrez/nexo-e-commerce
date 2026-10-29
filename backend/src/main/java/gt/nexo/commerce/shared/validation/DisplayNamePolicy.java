package gt.nexo.commerce.shared.validation;

import java.util.regex.Pattern;

public final class DisplayNamePolicy {
    private static final Pattern NAME = Pattern.compile("\\p{L}[\\p{L}\\p{M}]*(?:[ '\u2019-]\\p{L}[\\p{L}\\p{M}]*)*");

    private DisplayNamePolicy() { }

    public static boolean isValid(String value) {
        if (value == null) return false;
        String name = value.trim();
        int length = name.codePointCount(0, name.length());
        return length >= 2 && length <= 160 && NAME.matcher(name).matches();
    }
}
