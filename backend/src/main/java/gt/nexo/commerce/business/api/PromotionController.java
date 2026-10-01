package gt.nexo.commerce.business.api;

import gt.nexo.commerce.business.application.CommercePromotionService;
import java.math.BigDecimal;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PromotionController {
    private final CommercePromotionService service;

    public PromotionController(CommercePromotionService service) { this.service = service; }

    @GetMapping("/api/catalog/promotions")
    public Map<String, Object> publicPromotions() { return service.publicData(); }

    @PostMapping("/api/catalog/discounts/validate")
    public Map<String, Object> validate(@RequestBody Map<String, Object> input) {
        BigDecimal subtotal;
        try { subtotal = new BigDecimal(String.valueOf(input.get("subtotal"))); }
        catch (Exception exception) { return Map.of("valid", false, "message", "El subtotal no es válido."); }
        if (subtotal.signum() < 0 || subtotal.compareTo(new BigDecimal("999999999999")) > 0)
            return Map.of("valid", false, "message", "El subtotal no es válido.");
        return service.validateCode(String.valueOf(input.getOrDefault("code", "")), subtotal);
    }

    @GetMapping("/api/business/promotions")
    public Map<String, Object> adminPromotions() { return service.adminData(); }

    @PutMapping("/api/business/promotions")
    public Map<String, Object> save(@RequestBody Map<String, Object> input) { return service.saveData(input); }
}
