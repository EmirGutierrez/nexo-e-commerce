package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.business.application.BusinessRuleException;
import gt.nexo.commerce.identity.api.dto.RolePermissionsResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoleManagementService {
    private static final Set<String> LOCKED_ROLES = Set.of("superadmin", "customer");
    private final JdbcTemplate jdbc;
    private final PermissionAuthorizer authorizer;

    public RoleManagementService(JdbcTemplate jdbc, PermissionAuthorizer authorizer) {
        this.jdbc = jdbc;
        this.authorizer = authorizer;
    }

    @Transactional(readOnly = true)
    public List<RolePermissionsResponse> list() {
        require("view");
        return jdbc.query("SELECT code, display_name, description, is_system, (SELECT COUNT(*) FROM app_user u WHERE u.role_code = r.code) users FROM roles r ORDER BY code", (rs, row) -> {
            String code = rs.getString("code");
            Map<String, List<String>> permissions = new LinkedHashMap<>();
            jdbc.query("SELECT module_code, action_code FROM role_permissions WHERE role_code = ? ORDER BY module_code, action_code", rows -> {
                permissions.computeIfAbsent(rows.getString(1), ignored -> new ArrayList<>()).add(rows.getString(2));
            }, code);
            return new RolePermissionsResponse(code, rs.getString("display_name"), rs.getString("description"),
                    rs.getBoolean("is_system"), rs.getLong("users"), permissions);
        });
    }

    @Transactional
    public RolePermissionsResponse save(String code, Map<String, List<String>> requested) {
        require("edit");
        String role = code.trim().toLowerCase(java.util.Locale.ROOT);
        if (LOCKED_ROLES.contains(role)) throw new BusinessRuleException(HttpStatus.FORBIDDEN, "ROLE_LOCKED", "Los permisos de este rol están protegidos.");
        Boolean exists = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM roles WHERE code = ?)", Boolean.class, role);
        if (!Boolean.TRUE.equals(exists)) throw new BusinessRuleException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND", "El rol solicitado no existe.");
        Map<String, List<String>> normalized = new LinkedHashMap<>();
        for (var entry : requested.entrySet()) {
            List<String> actions = entry.getValue() == null ? List.of() : entry.getValue().stream().distinct().toList();
            for (String action : actions) {
                Boolean allowed = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM permissions WHERE module_code = ? AND action_code = ?)", Boolean.class, entry.getKey(), action);
                if (!Boolean.TRUE.equals(allowed)) throw new BusinessRuleException(HttpStatus.BAD_REQUEST, "INVALID_PERMISSION", "Se recibió un permiso no disponible.");
            }
            normalized.put(entry.getKey(), actions);
        }
        jdbc.update("DELETE FROM role_permissions WHERE role_code = ?", role);
        for (var entry : normalized.entrySet()) for (String action : entry.getValue()) {
            jdbc.update("INSERT INTO role_permissions (role_code, module_code, action_code) VALUES (?, ?, ?)", role, entry.getKey(), action);
        }
        return listWithoutPermissionCheck(role);
    }

    private RolePermissionsResponse listWithoutPermissionCheck(String code) {
        Map<String, List<String>> permissions = new LinkedHashMap<>();
        jdbc.query("SELECT module_code, action_code FROM role_permissions WHERE role_code = ? ORDER BY module_code, action_code",
                (RowCallbackHandler) rs -> permissions.computeIfAbsent(rs.getString(1), ignored -> new ArrayList<>()).add(rs.getString(2)), code);
        return jdbc.queryForObject("""
                SELECT code, display_name, description, is_system,
                (SELECT COUNT(*) FROM app_user u WHERE u.role_code = r.code) users FROM roles r WHERE code = ?
                """, (rs, row) -> new RolePermissionsResponse(rs.getString("code"), rs.getString("display_name"),
                rs.getString("description"), rs.getBoolean("is_system"), rs.getLong("users"), permissions), code);
    }

    private void require(String action) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!authorizer.has(authentication, "users", action)) throw new AccessDeniedException("Permiso users:" + action + " requerido.");
    }
}
