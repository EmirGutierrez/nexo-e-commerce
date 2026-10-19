package gt.nexo.commerce.business.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class PublicProductResponseTest {
    @Test
    void exposesOnlyPublicCatalogFieldsAndOmitsInternalCostAndLocation() {
        Map<String, Object> product = new LinkedHashMap<>();
        product.put("id", "product-1");
        product.put("name", "Cobra HyperSpeed Mouse Gaming");
        product.put("category", "Tecnología");
        product.put("price", "405.90");
        product.put("stock", 12);
        product.put("sku", "MOU-1");
        product.put("cost", 200);
        product.put("location", "Bodega A");

        PublicProductResponse response = PublicProductResponse.from(product);
        Set<String> serializedFields = Arrays.stream(PublicProductResponse.class.getRecordComponents())
                .map(component -> component.getName()).collect(Collectors.toSet());

        assertEquals(new BigDecimal("405.90"), response.price());
        assertEquals(12, response.stock());
        assertFalse(serializedFields.contains("cost"));
        assertFalse(serializedFields.contains("location"));
        assertNull(response.compareAt());
    }

    @Test
    void ignoresMalformedOptionalValuesInsteadOfFailingThePublicCatalog() {
        Map<String, Object> product = new LinkedHashMap<>();
        product.put("price", "not-a-price");
        product.put("stock", "unknown");
        product.put("featured", "not-a-boolean");

        PublicProductResponse response = PublicProductResponse.from(product);

        assertNull(response.price());
        assertNull(response.stock());
        assertEquals(Boolean.FALSE, response.featured());
    }
}
