package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.PermissionEntity;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public final class NexoUserPrincipal implements UserDetails {
    private final UUID id;
    private final String email;
    private final String displayName;
    private final String passwordHash;
    private final String roleCode;
    private final UserStatus status;
    private final Instant lockedUntil;
    private final List<String> permissions;
    private final List<GrantedAuthority> authorities;

    private NexoUserPrincipal(AppUserEntity account) {
        id = account.getId();
        email = account.getEmail();
        displayName = account.getDisplayName();
        passwordHash = account.getPasswordHash();
        roleCode = account.getRole().getCode();
        status = account.getStatus();
        lockedUntil = account.getLockedUntil();
        permissions = account.getRole().getPermissions().stream()
                .map(PermissionEntity::getId)
                .map(permission -> permission.getModuleCode() + ":" + permission.getActionCode())
                .sorted(Comparator.naturalOrder())
                .toList();
        List<GrantedAuthority> mapped = new ArrayList<>();
        mapped.add(new SimpleGrantedAuthority("ROLE_" + roleCode.toUpperCase(java.util.Locale.ROOT)));
        permissions.stream()
                .map(permission -> new SimpleGrantedAuthority("PERMISSION_" + permission.replace(':', '_')))
                .forEach(mapped::add);
        authorities = List.copyOf(mapped);
    }

    public static NexoUserPrincipal from(AppUserEntity account) {
        return new NexoUserPrincipal(account);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    @Override
    public String getPassword() { return passwordHash; }
    @Override
    public String getUsername() { return email; }
    @Override
    public boolean isAccountNonExpired() { return true; }
    @Override
    public boolean isAccountNonLocked() {
        return status != UserStatus.LOCKED && (lockedUntil == null || !lockedUntil.isAfter(Instant.now()));
    }
    @Override
    public boolean isCredentialsNonExpired() { return true; }
    @Override
    public boolean isEnabled() { return status == UserStatus.ACTIVE; }

    public UUID getId() { return id; }
    public String getDisplayName() { return displayName; }
    public String getRoleCode() { return roleCode; }
    public List<String> getPermissions() { return permissions; }
}
