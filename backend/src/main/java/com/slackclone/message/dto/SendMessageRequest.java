package com.slackclone.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(

        @NotBlank(message = "메시지 내용은 필수입니다.")
        @Size(max = 4000, message = "메시지는 4000자 이하여야 합니다.")
        String content,

        String parentId
) {}
