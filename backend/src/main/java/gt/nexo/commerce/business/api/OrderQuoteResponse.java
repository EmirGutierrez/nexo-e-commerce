package gt.nexo.commerce.business.api;

import java.math.BigDecimal;
import java.util.List;

public record OrderQuoteResponse(BigDecimal subtotal, BigDecimal discount, BigDecimal total, List<Item> items) {
    public record Item(String productId, String productName, int quantity, BigDecimal unitPrice, BigDecimal subtotal) { }
}
