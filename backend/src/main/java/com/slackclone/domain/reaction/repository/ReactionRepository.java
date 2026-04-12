package com.slackclone.domain.reaction.repository;

import com.slackclone.domain.reaction.entity.Reaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReactionRepository extends JpaRepository<Reaction, UUID> {

    @Query("SELECT r FROM Reaction r JOIN FETCH r.user WHERE r.message.id = :messageId")
    List<Reaction> findAllByMessageId(@Param("messageId") UUID messageId);

    @Query("SELECT r FROM Reaction r JOIN FETCH r.user WHERE r.directMessage.id = :dmId")
    List<Reaction> findAllByDirectMessageId(@Param("dmId") UUID dmId);

    Optional<Reaction> findByMessageIdAndUserIdAndEmoji(UUID messageId, UUID userId, String emoji);

    Optional<Reaction> findByDirectMessageIdAndUserIdAndEmoji(UUID directMessageId, UUID userId, String emoji);

    boolean existsByMessageIdAndUserIdAndEmoji(UUID messageId, UUID userId, String emoji);
}
