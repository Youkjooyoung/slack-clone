package com.slackclone.domain.message.repository;

import com.slackclone.domain.message.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}
