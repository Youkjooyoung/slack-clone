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
        OffsetDateTime updatedAt
) {
    public static MessageResponse from(Message message) {
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
                message.getUpdatedAt()
        );
    }
}
