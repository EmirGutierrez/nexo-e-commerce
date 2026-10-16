package gt.nexo.commerce.business.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.business.application.BusinessRecordService;
import gt.nexo.commerce.business.application.ProductImageService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PublicCatalogControllerTest {
    private final BusinessRecordService service = mock(BusinessRecordService.class);
    private final PublicCatalogController controller = new PublicCatalogController(service, mock(ProductImageService.class));

    @Test
    void mapsListsAndDetailsThroughThePublicProductAllowList() {
        UUID id = UUID.randomUUID();
        Map<String, Object> product = Map.of("id", id.toString(), "name", "Monitor", "price", new BigDecimal("100.00"),
                "stock", 4, "cost", new BigDecimal("50.00"), "location", "Bodega A");
        when(service.publicProducts()).thenReturn(List.of(product));
        when(service.publicProduct(id)).thenReturn(product);

        PublicProductResponse listed = controller.list().getFirst();
        PublicProductResponse details = controller.get(id);

        assertEquals(id.toString(), listed.id());
        assertEquals(new BigDecimal("100.00"), listed.price());
        assertEquals(id.toString(), details.id());
        assertEquals(new BigDecimal("100.00"), details.price());
    }
}
