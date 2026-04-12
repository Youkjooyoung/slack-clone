package com.slackclone.file.dto;

import com.slackclone.domain.attachment.entity.Attachment;

import java.time.OffsetDateTime;
import java.util.UUID;

public record FileListResponse(
        UUID attachmentId,
        String fileName,
        String fileUrl,
        String mimeType,
        long fileSize,
        OffsetDateTime uploadedAt
) {
    public static FileListResponse from(Attachment attachment) {
        return new FileListResponse(
                attachment.getId(),
                attachment.getFileName(),
                attachment.getFileUrl(),
                attachment.getMimeType() != null ? attachment.getMimeType() : "application/octet-stream",
                attachment.getFileSize() != null ? attachment.getFileSize() : 0L,
                attachment.getCreatedAt()
        );
    }
}
