package com.slackclone.channel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateChannelRequest(

        @NotBlank(message = "채널 이름은 필수입니다.")
        @Size(max = 100, message = "채널 이름은 100자 이하여야 합니다.")
        String name,

        String description
) {}
