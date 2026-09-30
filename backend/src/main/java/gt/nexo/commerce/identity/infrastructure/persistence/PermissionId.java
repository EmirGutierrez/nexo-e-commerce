package gt.nexo.commerce.identity.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class PermissionId implements Serializable {
    @Column(name = "module_code", nullable = false, length = 40)
    private String moduleCode;

    @Column(name = "action_code", nullable = false, length = 24)
    private String actionCode;

    protected PermissionId() {
    }

    public PermissionId(String moduleCode, String actionCode) {
        this.moduleCode = moduleCode;
        this.actionCode = actionCode;
    }

    public String getModuleCode() {
        return moduleCode;
    }

    public String getActionCode() {
        return actionCode;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof PermissionId that)) return false;
        return Objects.equals(moduleCode, that.moduleCode) && Objects.equals(actionCode, that.actionCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(moduleCode, actionCode);
    }
}
