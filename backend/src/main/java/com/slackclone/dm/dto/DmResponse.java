package com.slackclone.dm.dto;

import com.slackclone.domain.message.entity.DirectMessage;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DmResponse(
        UUID id,
        UUID workspaceId,
        UUID senderId,
        String senderUsername,
        String senderDisplayName,
        String senderAvatarUrl,
        UUID receiverId,
        String content,
        boolean isEdited,
        boolean isRead,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static DmResponse from(DirectMessage dm) {
        return new DmResponse(
                dm.getId(),
                dm.getWorkspace().getId(),
                dm.getSender().getId(),
                dm.getSender().getUsername(),
                dm.getSender().getDisplayName(),
                dm.getSender().getAvatarUrl(),
                dm.getReceiver().getId(),
                dm.getContent(),
                dm.isEdited(),
                dm.isRead(),
                dm.getCreatedAt(),
                dm.getUpdatedAt()
        );
    }
}
