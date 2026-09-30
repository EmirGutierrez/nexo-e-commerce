package gt.nexo.commerce.shared.errors;

import java.time.Instant;

public record ApiError(Instant timestamp, int status, String code, String message) {
}
