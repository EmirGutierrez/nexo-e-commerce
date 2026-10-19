package gt.nexo.commerce.business.api;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import gt.nexo.commerce.business.application.BusinessRecordService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BusinessRecordControllerInventoryEndpointTest {
    @Mock
    private BusinessRecordService service;

    @InjectMocks
    private BusinessRecordController controller;

    @Test
    void listsInventoryProductsThroughTheInventoryService() {
        List<BusinessRecordResponse> records = List.of();
        when(service.listInventoryProducts()).thenReturn(records);

        assertSame(records, controller.inventoryProducts());

        verify(service).listInventoryProducts();
    }

    @Test
    void listsSavedInventoryLocationsThroughTheInventoryService() {
        List<String> locations = List.of("Bodega A", "Bodega B");
        when(service.listInventoryLocations()).thenReturn(locations);

        assertSame(locations, controller.inventoryLocations());

        verify(service).listInventoryLocations();
    }

    @Test
    void updatesAnInventoryProductThroughTheInventoryService() {
        UUID id = UUID.randomUUID();
        Map<String, Object> data = Map.of("stock", 7);
        BusinessRecordResponse response = new BusinessRecordResponse(id, "products", data, null, null);
        when(service.updateInventoryProduct(id, data)).thenReturn(response);

        assertSame(response, controller.updateInventoryProduct(id, data));

        verify(service).updateInventoryProduct(id, data);
    }

    @Test
    void deletesAnInventoryProductThroughTheInventoryService() {
        UUID id = UUID.randomUUID();
        InventoryProductRemovalResponse response = new InventoryProductRemovalResponse(false);
        when(service.deleteInventoryProduct(id)).thenReturn(response);

        assertSame(response, controller.deleteInventoryProduct(id));

        verify(service).deleteInventoryProduct(id);
    }
}
