package gt.nexo.commerce.identity.infrastructure.persistence;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "permissions")
public class PermissionEntity {
    @EmbeddedId
    private PermissionId id;

    protected PermissionEntity() {
    }

    public PermissionId getId() {
        return id;
    }
}
