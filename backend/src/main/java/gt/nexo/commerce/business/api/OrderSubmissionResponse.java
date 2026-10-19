package gt.nexo.commerce.business.api;

import java.math.BigDecimal;

/** Minimal, non-PII response used to recover a checkout after a lost connection. */
public record OrderSubmissionResponse(String reference, BigDecimal total, String paymentMethod, String paymentStatus) { }
