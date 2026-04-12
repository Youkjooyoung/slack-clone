package com.slackclone.notification.dto;

import com.slackclone.domain.notification.entity.Notification;

import java.time.OffsetDateTime;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        String type,
        String title,
        String content,
        UUID referenceId,
        String referenceType,
        boolean isRead,
        OffsetDateTime createdAt
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getType().name(),
                n.getTitle(),
                n.getContent(),
                n.getReferenceId(),
                n.getReferenceType() != null ? n.getReferenceType().name() : null,
                n.isRead(),
                n.getCreatedAt()
        );
    }
}
