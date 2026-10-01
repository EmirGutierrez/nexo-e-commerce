package gt.nexo.commerce.identity.api.dto;

import java.time.Instant;

public record MobileLoginResponse(String accessToken, String tokenType, Instant expiresAt, UserResponse user) {
}
