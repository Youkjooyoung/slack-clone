package com.slackclone.domain.message.repository;

import com.slackclone.domain.message.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID>, MessageRepositoryCustom {

    @Query("""
            SELECT m FROM Message m
            JOIN FETCH m.sender
            WHERE m.channel.id = :channelId
              AND m.parent IS NULL
              AND m.deletedAt IS NULL
            ORDER BY m.createdAt DESC
            """)
    Slice<Message> findByChannelIdCursor(@Param("channelId") UUID channelId, Pageable pageable);

    @Query("""
            SELECT m FROM Message m
            JOIN FETCH m.sender
            WHERE m.parent.id = :parentId
              AND m.deletedAt IS NULL
            ORDER BY m.createdAt ASC
            """)
    List<Message> findRepliesByParentId(@Param("parentId") UUID parentId);

    @Query("""
            SELECT COUNT(m) FROM Message m
            WHERE m.channel.id = :channelId
              AND m.parent IS NULL
              AND m.deletedAt IS NULL
              AND m.createdAt > :since
              AND m.sender.id != :userId
            """)
    long countUnreadMessages(@Param("channelId") UUID channelId,
                             @Param("since") OffsetDateTime since,
                             @Param("userId") UUID userId);

    @Query("""
            SELECT m.parent.id, COUNT(m)
            FROM Message m
            WHERE m.parent.id IN :parentIds
              AND m.deletedAt IS NULL
            GROUP BY m.parent.id
            """)
    List<Object[]> countRepliesByParentIds(@Param("parentIds") List<UUID> parentIds);
}
