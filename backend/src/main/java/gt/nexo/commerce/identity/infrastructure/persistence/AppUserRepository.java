package gt.nexo.commerce.identity.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUserEntity, UUID> {
    boolean existsByRole_Code(String roleCode);

    @EntityGraph(attributePaths = {"role", "role.permissions"})
    Optional<AppUserEntity> findByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = {"role", "role.permissions"})
    List<AppUserEntity> findAllByOrderByDisplayNameAsc();
    long countByRole_Code(String roleCode);
}
