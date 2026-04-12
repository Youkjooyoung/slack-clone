package com.slackclone.domain.message.repository;

import com.slackclone.domain.message.entity.DirectMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface DirectMessageRepository extends JpaRepository<DirectMessage, UUID> {

    @Query("""
            SELECT dm FROM DirectMessage dm
            JOIN FETCH dm.sender
            JOIN FETCH dm.receiver
            WHERE dm.workspace.id = :workspaceId
              AND ((dm.sender.id = :userId1 AND dm.receiver.id = :userId2)
                   OR (dm.sender.id = :userId2 AND dm.receiver.id = :userId1))
              AND (:cursor IS NULL OR dm.createdAt < :cursor)
            ORDER BY dm.createdAt DESC
            """)
    List<DirectMessage> findConversation(
            @Param("workspaceId") UUID workspaceId,
            @Param("userId1") UUID userId1,
            @Param("userId2") UUID userId2,
            @Param("cursor") OffsetDateTime cursor,
            Pageable pageable
    );
}
