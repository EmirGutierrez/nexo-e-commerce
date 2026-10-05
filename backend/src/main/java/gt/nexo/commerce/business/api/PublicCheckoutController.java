package gt.nexo.commerce.business.api;

import gt.nexo.commerce.business.application.BusinessRecordService;
import io.swagger.v3.oas.annotations.Operation;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import gt.nexo.commerce.identity.application.NexoUserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog")
public class PublicCheckoutController {
    private final BusinessRecordService service;
    public PublicCheckoutController(BusinessRecordService service) { this.service = service; }

    @GetMapping("/payment-methods")
    @Operation(summary = "Consulta métodos de pago habilitados para checkout.")
    public Map<String, Object> paymentMethods() { return service.publicPaymentSettings(); }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Crea un pedido, calcula importes con precios vigentes y reserva inventario.")
    public BusinessRecordResponse createOrder(@RequestBody Map<String, Object> input, Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof NexoUserPrincipal principal && "customer".equals(principal.getRoleCode())) {
            input.put("customerName", principal.getDisplayName());
            input.put("customerEmail", principal.getUsername());
            return service.createCustomerOrder(input, principal.getId());
        }
        return service.createPublicOrder(input);
    }

    @GetMapping("/my/orders")
    public List<BusinessRecordResponse> myOrders(Authentication authentication) {
        return service.customerOrders(customer(authentication).getId());
    }

    @GetMapping("/my/wishlist")
    public List<Map<String, Object>> myWishlist(Authentication authentication) {
        return service.customerWishlist(customer(authentication).getId());
    }

    @GetMapping("/my/notifications")
    public Map<String, Object> myNotifications(Authentication authentication) {
        return service.customerNotifications(customer(authentication).getId());
    }

    @PatchMapping("/my/notifications/{notificationId}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markNotificationRead(@org.springframework.web.bind.annotation.PathVariable UUID notificationId, Authentication authentication) {
        service.markCustomerNotificationRead(customer(authentication).getId(), notificationId);
    }

    @PatchMapping("/my/notifications/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllNotificationsRead(Authentication authentication) {
        service.markAllCustomerNotificationsRead(customer(authentication).getId());
    }

    @PostMapping("/my/wishlist/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addWishlistItem(@org.springframework.web.bind.annotation.PathVariable UUID productId, Authentication authentication) {
        service.addCustomerWishlistItem(customer(authentication).getId(), productId);
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/my/wishlist/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeWishlistItem(@org.springframework.web.bind.annotation.PathVariable UUID productId, Authentication authentication) {
        service.removeCustomerWishlistItem(customer(authentication).getId(), productId);
    }

    private NexoUserPrincipal customer(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof NexoUserPrincipal principal) || !"customer".equals(principal.getRoleCode())) {
            throw new org.springframework.security.access.AccessDeniedException("Se requiere una cuenta de cliente.");
        }
        return principal;
    }
}
