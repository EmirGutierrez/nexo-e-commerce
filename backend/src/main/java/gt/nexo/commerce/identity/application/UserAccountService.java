package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.api.dto.UserResponse;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import gt.nexo.commerce.business.application.BusinessRuleException;
import org.springframework.http.HttpStatus;
import gt.nexo.commerce.identity.infrastructure.persistence.RoleRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import java.util.List;
import java.util.UUID;
import java.util.ArrayList;
import java.time.Instant;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

@Service
public class UserAccountService {
    private final AppUserRepository users;
    private final RoleRepository roles;
    private final PermissionAuthorizer authorizer;
    private final JdbcTemplate jdbc;

    public UserAccountService(AppUserRepository users, RoleRepository roles, PermissionAuthorizer authorizer, JdbcTemplate jdbc) {
        this.users = users; this.roles = roles; this.authorizer = authorizer; this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public UserResponse currentUser(UUID id) {
        return users.findById(id)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE && !user.isCurrentlyLocked(Instant.now()))
                .map(this::response)
                .orElseThrow(() -> new UsernameNotFoundException("The authenticated account is unavailable"));
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listUsers() {
        return users.findAllByOrderByDisplayNameAsc().stream()
                .filter(user -> !user.getRole().getCode().equals("customer"))
                .map(this::response).toList();
    }

    @Transactional
    public UserResponse updateOwnProfile(UUID id, String displayName) {
        String name = displayName == null ? "" : displayName.trim();
        if (name.length() < 2 || name.length() > 160) throw new BusinessRuleException(
                HttpStatus.BAD_REQUEST, "INVALID_PROFILE_NAME", "El nombre debe tener entre 2 y 160 caracteres.");
        var user = users.findById(id)
                .filter(account -> account.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new UsernameNotFoundException("The authenticated account is unavailable"));
        user.changeDisplayName(name);
        if ("customer".equals(user.getRole().getCode())) {
            jdbc.update("UPDATE business_records SET data = jsonb_set(data, '{name}', to_jsonb(?::text)), updated_at = CURRENT_TIMESTAMP WHERE resource_code = 'customers' AND LOWER(data ->> 'email') = LOWER(?)", name, user.getEmail());
            jdbc.update("UPDATE business_records SET data = jsonb_set(data, '{customer}', to_jsonb(?::text)), updated_at = CURRENT_TIMESTAMP WHERE resource_code = 'orders' AND LOWER(data ->> 'customerEmail') = LOWER(?)", name, user.getEmail());
            jdbc.update("UPDATE customers SET name = ? WHERE LOWER(email) = LOWER(?)", name, user.getEmail());
            jdbc.update("UPDATE commerce_orders SET customer_name = ? WHERE customer_user_id = ?", name, id);
        }
        return response(user);
    }

    @Transactional
    public void updateRole(UUID id, String roleCode, Authentication authentication) {
        requireUserEdit(authentication);
        var user = users.findById(id).orElseThrow(() -> new UsernameNotFoundException("User not found"));
        if (user.getRole().getCode().equals("customer")) throw new BusinessRuleException(HttpStatus.BAD_REQUEST,
                "CUSTOMER_ROLE_MANAGEMENT", "Las cuentas de cliente no se cambian desde la administración de equipo.");
        String nextCode = roleCode == null ? "" : roleCode.trim().toLowerCase(java.util.Locale.ROOT);
        boolean isSuperAdmin = authentication.getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_SUPERADMIN"));
        if (nextCode.equals("superadmin") && !isSuperAdmin) throw new AccessDeniedException("Solo el Súper Administrador puede asignar ese rol.");
        if (user.getRole().getCode().equals("superadmin") && !nextCode.equals("superadmin")) {
            if (!isSuperAdmin) throw new AccessDeniedException("Solo el Súper Administrador puede cambiar este rol protegido.");
            lockSuperadminRole();
            if (user.getStatus() == UserStatus.ACTIVE && users.countByRole_CodeAndStatus("superadmin", UserStatus.ACTIVE) <= 1) {
                throw new BusinessRuleException(HttpStatus.CONFLICT, "LAST_SUPERADMIN", "No se puede retirar al último Súper Administrador activo.");
            }
        }
        var role = roles.findById(nextCode).orElseThrow(() -> new BusinessRuleException(HttpStatus.BAD_REQUEST, "ROLE_NOT_FOUND", "El rol solicitado no existe."));
        user.changeRole(role);
    }

    @Transactional
    public void updateStatus(UUID id, String status, Authentication authentication) {
        requireUserEdit(authentication);
        var user = users.findById(id).orElseThrow(() -> new UsernameNotFoundException("User not found"));
        if (user.getRole().getCode().equals("customer")) throw new BusinessRuleException(HttpStatus.BAD_REQUEST,
                "CUSTOMER_STATUS_MANAGEMENT", "Las cuentas de cliente se administran desde el módulo de clientes.");
        boolean isSuperAdmin = authentication.getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_SUPERADMIN"));
        if (user.getRole().getCode().equals("superadmin") && !isSuperAdmin) throw new AccessDeniedException("Solo el Súper Administrador puede cambiar esta cuenta protegida.");
        UserStatus next;
        try { next = UserStatus.valueOf(status); }
        catch (Exception exception) { throw new BusinessRuleException(HttpStatus.BAD_REQUEST, "INVALID_USER_STATUS", "El estado de cuenta no es válido."); }
        if (user.getRole().getCode().equals("superadmin") && user.getStatus() == UserStatus.ACTIVE && next != UserStatus.ACTIVE) {
            lockSuperadminRole();
            if (users.countByRole_CodeAndStatus("superadmin", UserStatus.ACTIVE) <= 1) throw new BusinessRuleException(HttpStatus.CONFLICT,
                    "LAST_SUPERADMIN", "No se puede desactivar al último Súper Administrador activo.");
        }
        user.changeStatus(next);
    }

    @Transactional
    public void updateTeamUser(UUID id, String roleCode, String status, Authentication authentication) {
        requireUserEdit(authentication);
        var user = users.findById(id).orElseThrow(() -> new UsernameNotFoundException("User not found"));
        if (user.getRole().getCode().equals("customer")) throw new BusinessRuleException(HttpStatus.BAD_REQUEST,
                "CUSTOMER_TEAM_MANAGEMENT", "Las cuentas de cliente se administran desde el módulo de clientes.");
        if (roleCode != null && !roleCode.isBlank()) updateRole(id, roleCode, authentication);
        if (status != null && !status.isBlank()) updateStatus(id, status, authentication);
    }

    @Transactional
    public void deleteTeamUser(UUID id, Authentication authentication) {
        if (!authorizer.has(authentication, "users", "delete"))
            throw new AccessDeniedException("Se requiere users:delete.");

        var user = users.findById(id).orElseThrow(() -> new UsernameNotFoundException("User not found"));
        if (user.getRole().getCode().equals("customer")) throw new BusinessRuleException(HttpStatus.BAD_REQUEST,
                "CUSTOMER_TEAM_MANAGEMENT", "Las cuentas de cliente se administran desde el módulo de clientes.");
        if (user.getStatus() == UserStatus.PENDING) throw new BusinessRuleException(HttpStatus.CONFLICT,
                "INVITATION_MUST_BE_REVOKED", "Revoca las invitaciones pendientes desde su acción correspondiente.");
        if (authentication.getName().equalsIgnoreCase(user.getEmail())) throw new BusinessRuleException(HttpStatus.CONFLICT,
                "CANNOT_DELETE_SELF", "No puedes eliminar tu propia cuenta del equipo.");

        if (user.getRole().getCode().equals("superadmin")) {
            boolean actorIsSuperAdmin = authentication.getAuthorities().stream()
                    .anyMatch(authority -> authority.getAuthority().equals("ROLE_SUPERADMIN"));
            if (!actorIsSuperAdmin) throw new AccessDeniedException("Solo el Súper Administrador puede eliminar otra cuenta protegida.");
            lockSuperadminRole();
            if (user.getStatus() == UserStatus.ACTIVE && users.countByRole_CodeAndStatus("superadmin", UserStatus.ACTIVE) <= 1) {
                throw new BusinessRuleException(HttpStatus.CONFLICT,
                        "LAST_SUPERADMIN", "No se puede eliminar al último Súper Administrador activo.");
            }
        }

        jdbc.update("DELETE FROM SPRING_SESSION WHERE LOWER(PRINCIPAL_NAME) = LOWER(?)", user.getEmail());
        users.delete(user);
    }

    private void lockSuperadminRole() {
        jdbc.queryForObject("SELECT code FROM roles WHERE code = 'superadmin' FOR UPDATE", String.class);
    }

    private void requireUserEdit(Authentication authentication) {
        if (!authorizer.has(authentication, "users", "edit")) throw new AccessDeniedException("Se requiere users:edit.");
    }

    private UserResponse response(gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity user) {
        var effective = new java.util.TreeSet<>(user.getRole().getPermissions().stream()
                .map(permission -> permission.getId().getModuleCode() + ":" + permission.getId().getActionCode()).toList());
        jdbc.query("SELECT module_code, action_code, granted FROM user_permissions WHERE user_id = ?", rs -> {
            String key = rs.getString("module_code") + ":" + rs.getString("action_code");
            if (rs.getBoolean("granted")) effective.add(key); else effective.remove(key);
        }, user.getId());
        return new UserResponse(user.getId(), user.getDisplayName(), user.getEmail(), user.getRole().getCode(),
                user.getStatus().name(), List.copyOf(effective), user.getLastLoginAt());
    }
}
