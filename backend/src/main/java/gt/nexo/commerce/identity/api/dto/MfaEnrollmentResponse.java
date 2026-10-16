package gt.nexo.commerce.identity.api.dto;

public record MfaEnrollmentResponse(String secret, String otpauthUri) { }
