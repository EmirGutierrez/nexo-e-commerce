package gt.nexo.commerce.shared.security;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class PrometheusTestController {
    @GetMapping("/actuator/prometheus")
    String scrapeMetrics() {
        return "metrics";
    }

    @PostMapping("/actuator/prometheus")
    String submitMetrics() {
        return "not allowed";
    }
}
