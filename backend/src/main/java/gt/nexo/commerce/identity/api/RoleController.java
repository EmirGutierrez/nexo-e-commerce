package gt.nexo.commerce.identity.api;

import gt.nexo.commerce.identity.api.dto.RolePermissionsResponse;
import gt.nexo.commerce.identity.application.RoleManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/roles")
@SecurityRequirement(name = "sessionCookie")
public class RoleController {
    private final RoleManagementService service;
    public RoleController(RoleManagementService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "Lista roles y permisos vigentes en PostgreSQL.")
    public List<RolePermissionsResponse> list() { return service.list(); }

    @PutMapping("/{code}/permissions")
    @Operation(summary = "Reemplaza de forma transaccional los permisos de un rol editable.")
    public RolePermissionsResponse save(@PathVariable String code, @RequestBody Map<String, List<String>> permissions) {
        return service.save(code, permissions);
    }
}
