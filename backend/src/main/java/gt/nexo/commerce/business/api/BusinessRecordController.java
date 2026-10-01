package gt.nexo.commerce.business.api;

import gt.nexo.commerce.business.application.BusinessRecordService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/business")
@SecurityRequirement(name = "sessionCookie")
public class BusinessRecordController {
    private final BusinessRecordService service;

    public BusinessRecordController(BusinessRecordService service) { this.service = service; }

    @GetMapping("/{resource}")
    @Operation(summary = "Lista registros persistentes del módulo autorizado.")
    public List<BusinessRecordResponse> list(@PathVariable String resource) { return service.list(resource); }

    @PostMapping("/{resource}")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Crea un registro de negocio con validaciones y auditoría de inventario.")
    public BusinessRecordResponse create(@PathVariable String resource, @RequestBody Map<String, Object> data) {
        return service.create(resource, data);
    }

    @PutMapping("/{resource}/{id}")
    @Operation(summary = "Actualiza un registro autorizado y registra ajustes de existencias.")
    public BusinessRecordResponse update(@PathVariable String resource, @PathVariable UUID id,
                                         @RequestBody Map<String, Object> data) {
        return service.update(resource, id, data);
    }

    @PatchMapping("/{resource}/{id}")
    @Operation(summary = "Actualiza un registro autorizado.")
    public BusinessRecordResponse patch(@PathVariable String resource, @PathVariable UUID id,
                                        @RequestBody Map<String, Object> data) {
        return service.update(resource, id, data);
    }

    @DeleteMapping("/{resource}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Elimina un registro cuando no tiene relaciones ni historial protegido.")
    public void delete(@PathVariable String resource, @PathVariable UUID id) { service.delete(resource, id); }

    @PostMapping("/sales/record")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Registra una venta presencial y descuenta stock dentro de una transacción.")
    public BusinessRecordResponse createSale(@RequestBody Map<String, Object> data) {
        return service.createInPersonSale(data);
    }

    @GetMapping("/inventory/summary")
    @Operation(summary = "Calcula existencias y alertas desde el catálogo persistente.")
    public Map<String, Object> inventorySummary() { return service.inventorySummary(); }

    @GetMapping("/inventory/movements")
    @Operation(summary = "Consulta el historial auditable de movimientos de inventario.")
    public List<Map<String, Object>> inventoryMovements() { return service.inventoryMovements(); }

    @GetMapping("/dashboard/summary")
    @Operation(summary = "Agrega métricas reales de ventas, pedidos, clientes e inventario.")
    public Map<String, Object> dashboardSummary(@RequestParam(defaultValue = "30d") String period) { return service.dashboardSummary(period); }

    @GetMapping("/settings/profile")
    @Operation(summary = "Consulta la configuración comercial persistida.")
    public Map<String, Object> businessProfileSettings() { return service.businessProfileSettings(); }

    @PutMapping("/settings/profile")
    @Operation(summary = "Guarda la configuración comercial validada en PostgreSQL.")
    public Map<String, Object> updateBusinessProfileSettings(@RequestBody Map<String, Object> input) {
        return service.updateBusinessProfileSettings(input);
    }

    @GetMapping("/payment-settings")
    @Operation(summary = "Consulta los métodos de pago simulados habilitados.")
    public Map<String, Object> paymentSettings() { return service.paymentSettings(); }

    @PutMapping("/payment-settings/{method}")
    @Operation(summary = "Guarda un método de pago simulado en PostgreSQL.")
    public Map<String, Object> updatePaymentSetting(@PathVariable String method, @RequestBody Map<String, Object> input) {
        return service.updatePaymentSetting(method, Boolean.TRUE.equals(input.get("enabled")));
    }

    @GetMapping("/transfers/receipts")
    public List<Map<String, Object>> transferReceipts() { return service.transferReceipts(); }

    @PatchMapping("/transfers/receipts/{id}")
    public Map<String, Object> reviewTransferReceipt(@PathVariable UUID id, @RequestBody Map<String, Object> input) {
        return service.reviewTransferReceipt(id, String.valueOf(input.getOrDefault("status", "")));
    }
}
