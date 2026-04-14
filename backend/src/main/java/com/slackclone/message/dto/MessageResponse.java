package com.slackclone.message.dto;

import com.slackclone.domain.message.entity.Message;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MessageResponse(
        UUID id,
        UUID channelId,
        UUID senderId,
        String senderUsername,
        String senderDisplayName,
        String senderAvatarUrl,
        String content,
        boolean isEdited,
        UUID parentId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        int replyCount
) {
    /** 답글 수 없이 생성 (WebSocket 실시간 전송용) */
    public static MessageResponse from(Message message) {
        return from(message, 0);
    }

    /** 답글 수 포함 생성 (목록 조회용) */
    public static MessageResponse from(Message message, int replyCount) {
        return new MessageResponse(
                message.getId(),
                message.getChannel().getId(),
                message.getSender().getId(),
                message.getSender().getUsername(),
                message.getSender().getDisplayName(),
                message.getSender().getAvatarUrl(),
                message.getContent(),
                message.isEdited(),
                message.getParent() != null ? message.getParent().getId() : null,
                message.getCreatedAt(),
                message.getUpdatedAt(),
                replyCount
        );
    }
}
