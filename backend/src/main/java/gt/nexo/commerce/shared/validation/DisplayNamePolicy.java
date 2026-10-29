package gt.nexo.commerce.shared.validation;

public final class DisplayNamePolicy {
    private DisplayNamePolicy() { }

    public static boolean isValid(String value) {
        if (value == null) return false;
        String name = value.trim();
        if (name.length() > 320) return false;
        int length = name.codePointCount(0, name.length());
        if (length < 2 || length > 160) return false;

        boolean previousCodePointCanContinueName = false;
        boolean foundLetter = false;
        for (int offset = 0; offset < name.length();) {
            int codePoint = name.codePointAt(offset);
            int category = Character.getType(codePoint);
            if (Character.isLetter(codePoint)) {
                foundLetter = true;
                previousCodePointCanContinueName = true;
            } else if (isCombiningMark(category)) {
                if (!previousCodePointCanContinueName) return false;
            } else if (isNameSeparator(codePoint)) {
                if (!previousCodePointCanContinueName) return false;
                previousCodePointCanContinueName = false;
            } else {
                return false;
            }
            offset += Character.charCount(codePoint);
        }
        return foundLetter && previousCodePointCanContinueName;
    }

    private static boolean isCombiningMark(int category) {
        return category == Character.NON_SPACING_MARK
                || category == Character.COMBINING_SPACING_MARK
                || category == Character.ENCLOSING_MARK;
    }

    private static boolean isNameSeparator(int codePoint) {
        return codePoint == ' ' || codePoint == '-' || codePoint == '\'' || codePoint == '\u2019';
    }
}
