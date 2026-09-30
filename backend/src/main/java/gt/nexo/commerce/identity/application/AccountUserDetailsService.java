package gt.nexo.commerce.identity.application;

import gt.nexo.commerce.identity.infrastructure.persistence.AppUserRepository;
import java.util.Locale;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountUserDetailsService implements UserDetailsService {
    private final AppUserRepository users;

    public AccountUserDetailsService(AppUserRepository users) { this.users = users; }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String normalizedEmail = username.trim().toLowerCase(Locale.ROOT);
        return users.findByEmailIgnoreCase(normalizedEmail)
                .map(NexoUserPrincipal::from)
                .orElseThrow(() -> new UsernameNotFoundException("Account not found"));
    }
}
