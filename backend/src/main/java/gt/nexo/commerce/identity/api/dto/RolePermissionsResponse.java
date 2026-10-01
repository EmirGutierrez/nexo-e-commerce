package gt.nexo.commerce.identity.api.dto;

import java.util.List;
import java.util.Map;

public record RolePermissionsResponse(String code, String displayName, String description,
                                      boolean system, long users, Map<String, List<String>> permissions) { }
