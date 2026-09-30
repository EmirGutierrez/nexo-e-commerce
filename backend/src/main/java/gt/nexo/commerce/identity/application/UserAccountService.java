package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.api.dto.UserResponse;
import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import gt.nexo.commerce.identity.infrastructure.persistence.UserStatus;
import java.util.List;
import java.util.UUID;
import java.time.Instant;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAccountService {
    private final AppUserRepository users;

    public UserAccountService(AppUserRepository users) { this.users = users; }

    @Transactional(readOnly = true)
    public UserResponse currentUser(UUID id) {
        return users.findById(id)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE && !user.isCurrentlyLocked(Instant.now()))
                .map(UserResponse::from)
                .orElseThrow(() -> new UsernameNotFoundException("The authenticated account is unavailable"));
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listUsers() {
        return users.findAllByOrderByDisplayNameAsc().stream().map(UserResponse::from).toList();
    }
}
