package gt.nexo.commerce.identity.api;

import gt.nexo.commerce.identity.api.dto.UserResponse;
import gt.nexo.commerce.identity.api.dto.TeamInvitationRequest;
import gt.nexo.commerce.identity.api.dto.TeamInvitationResponse;
import gt.nexo.commerce.identity.application.UserAccountService;
import gt.nexo.commerce.identity.application.TeamInvitationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.security.core.Authentication;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/users")
@SecurityRequirement(name = "sessionCookie")
public class UserController {
    private final UserAccountService userAccountService;
    private final TeamInvitationService teamInvitationService;

    public UserController(UserAccountService userAccountService, TeamInvitationService teamInvitationService) {
        this.userAccountService = userAccountService;
        this.teamInvitationService = teamInvitationService;
    }

    @GetMapping
    @PreAuthorize("@permissionAuthorizer.has(authentication, 'users', 'view')")
    @Operation(summary = "Lista las cuentas de personal; requiere el permiso users:view.")
    public List<UserResponse> list() {
        return userAccountService.listUsers();
    }

    @org.springframework.web.bind.annotation.PostMapping("/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@permissionAuthorizer.has(authentication, 'users', 'create')")
    @Operation(summary = "Crea una invitación de un solo uso para un miembro del equipo.")
    public TeamInvitationResponse invite(@Valid @RequestBody TeamInvitationRequest request, Authentication authentication) {
        return teamInvitationService.invite(request, authentication);
    }

    @PatchMapping("/{id}/role")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@permissionAuthorizer.has(authentication, 'users', 'edit')")
    @Operation(summary = "Cambia el rol de una cuenta existente con protección del Súper Administrador.")
    public void updateRole(@PathVariable UUID id, @RequestBody Map<String, String> request, Authentication authentication) {
        userAccountService.updateRole(id, request.get("role"), authentication);
    }

    @PatchMapping("/{id}/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@permissionAuthorizer.has(authentication, 'users', 'edit')")
    @Operation(summary = "Cambia el estado de una cuenta sin borrar su historial.")
    public void updateStatus(@PathVariable UUID id, @RequestBody Map<String, String> request, Authentication authentication) {
        userAccountService.updateStatus(id, request.get("status"), authentication);
    }

    @PatchMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@permissionAuthorizer.has(authentication, 'users', 'edit')")
    @Operation(summary = "Actualiza el rol y el estado del miembro del equipo en una sola transacción.")
    public void updateTeamUser(@PathVariable UUID id, @RequestBody Map<String, String> request, Authentication authentication) {
        userAccountService.updateTeamUser(id, request.get("role"), request.get("status"), authentication);
    }
}
