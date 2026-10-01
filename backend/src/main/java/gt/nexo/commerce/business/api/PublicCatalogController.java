package gt.nexo.commerce.business.api;

import gt.nexo.commerce.business.application.BusinessRecordService;
import io.swagger.v3.oas.annotations.Operation;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog/products")
public class PublicCatalogController {
    private final BusinessRecordService service;
    public PublicCatalogController(BusinessRecordService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "Lista el catálogo público desde PostgreSQL.")
    public List<Map<String, Object>> list() { return service.publicProducts(); }

    @GetMapping("/{id}")
    @Operation(summary = "Consulta un producto activo del catálogo público.")
    public Map<String, Object> get(@PathVariable UUID id) { return service.publicProduct(id); }
}
