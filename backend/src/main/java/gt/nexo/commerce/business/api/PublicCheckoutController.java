package gt.nexo.commerce.business.api;

import gt.nexo.commerce.business.application.BusinessRecordService;
import io.swagger.v3.oas.annotations.Operation;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
    public BusinessRecordResponse createOrder(@RequestBody Map<String, Object> input) { return service.createPublicOrder(input); }
}
