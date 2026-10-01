package gt.nexo.commerce.identity.api.dto;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.PermissionEntity;
import java.util.List;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String name,
        String email,
        String role,
        String status,
        List<String> permissions) {

    public static UserResponse from(AppUserEntity user) {
        List<String> permissions = user.getRole().getPermissions().stream()
                .map(PermissionEntity::getId)
                .map(permission -> permission.getModuleCode() + ":" + permission.getActionCode())
                .sorted()
                .toList();
        return new UserResponse(user.getId(), user.getDisplayName(), user.getEmail(),
                user.getRole().getCode(), user.getStatus().name(), permissions);
    }
}
