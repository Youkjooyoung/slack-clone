package com.slackclone.file.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record FileUploadRequest(

        @NotBlank(message = "파일 이름은 필수입니다.")
        String fileName,

        @NotBlank(message = "MIME 타입은 필수입니다.")
        String mimeType,

        @Positive(message = "파일 크기는 0보다 커야 합니다.")
        long fileSize
) {}
