package gt.nexo.commerce.business.api;

import gt.nexo.commerce.business.application.BusinessRecordService;
import gt.nexo.commerce.business.application.ProductImageService;
import io.swagger.v3.oas.annotations.Operation;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog/products")
public class PublicCatalogController {
    private final BusinessRecordService service;
    private final ProductImageService productImages;
    public PublicCatalogController(BusinessRecordService service, ProductImageService productImages) {
        this.service = service;
        this.productImages = productImages;
    }

    @GetMapping
    @Operation(summary = "Lista el catálogo público desde PostgreSQL.")
    public List<Map<String, Object>> list() { return service.publicProducts(); }

    @GetMapping("/{id}")
    @Operation(summary = "Consulta un producto activo del catálogo público.")
    public Map<String, Object> get(@PathVariable UUID id) { return service.publicProduct(id); }

    @GetMapping("/{id}/image")
    @Operation(summary = "Devuelve la imagen pública asociada a un producto.")
    public ResponseEntity<byte[]> image(@PathVariable UUID id) {
        return productImages.find(id).map(image -> ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                .header("X-Content-Type-Options", "nosniff")
                .body(image.bytes()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
