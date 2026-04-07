package com.slackclone.file.dto;

import java.util.UUID;

public record FileUploadResponse(
        UUID attachmentId,
        String presignedUrl,
        String fileUrl,
        String fileName,
        String mimeType,
        long fileSize
) {}
