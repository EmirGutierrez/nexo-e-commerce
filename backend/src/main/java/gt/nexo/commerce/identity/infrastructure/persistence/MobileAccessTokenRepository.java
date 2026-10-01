package gt.nexo.commerce.identity.infrastructure.persistence;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MobileAccessTokenRepository extends JpaRepository<MobileAccessTokenEntity, String> {
    @EntityGraph(attributePaths = {"user", "user.role", "user.role.permissions"})
    Optional<MobileAccessTokenEntity> findByTokenHash(String tokenHash);

    @Modifying
    @Query("delete from MobileAccessTokenEntity token where token.tokenHash = :tokenHash")
    int deleteByTokenHash(@Param("tokenHash") String tokenHash);

    @Modifying
    @Query("delete from MobileAccessTokenEntity token where token.expiresAt <= :now")
    int deleteExpiredBefore(@Param("now") Instant now);
}
