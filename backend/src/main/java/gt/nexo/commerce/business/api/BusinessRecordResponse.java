package gt.nexo.commerce.business.api;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record BusinessRecordResponse(UUID id, String resource, Map<String, Object> data,
                                     Instant createdAt, Instant updatedAt) { }
