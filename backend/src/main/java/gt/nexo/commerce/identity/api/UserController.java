package gt.nexo.commerce.identity.api;

import gt.nexo.commerce.identity.api.dto.UserResponse;
import gt.nexo.commerce.identity.application.UserAccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@SecurityRequirement(name = "sessionCookie")
public class UserController {
    private final UserAccountService userAccountService;

    public UserController(UserAccountService userAccountService) { this.userAccountService = userAccountService; }

    @GetMapping
    @PreAuthorize("@permissionAuthorizer.has(authentication, 'users', 'view')")
    @Operation(summary = "Lista las cuentas de personal; requiere el permiso users:view.")
    public List<UserResponse> list() {
        return userAccountService.listUsers();
    }
}
