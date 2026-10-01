package gt.nexo.commerce.identity.api.dto;

import java.util.UUID;

public record TeamInvitationResponse(UUID id, String email, String status, String token) { }
