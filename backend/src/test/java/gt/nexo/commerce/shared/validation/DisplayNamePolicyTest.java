package gt.nexo.commerce.shared.validation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DisplayNamePolicyTest {
    @Test
    void acceptsInternationalNamesWithAccentsSpacesHyphensAndApostrophes() {
        for (String name : new String[] {"María García", "Ana-María O’Connor", "Jean-Luc D'Arcy", "李 小龍"}) {
            assertTrue(DisplayNamePolicy.isValid(name), name);
        }
    }

    @Test
    void rejectsHtmlNumbersAndInvalidSeparators() {
        for (String name : new String[] {"", "A", "7777", "Ana 123", "<h1>Ana</h1>",
                "<img src=x onerror=alert(1)>", "Ana@@Maria", "Ana--María", "\u0301Ana", "A".repeat(161)}) {
            assertFalse(DisplayNamePolicy.isValid(name), name);
        }
    }
}
