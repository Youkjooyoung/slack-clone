package com.slackclone.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshRequest(

        @NotBlank(message = "RefreshToken은 필수입니다.")
        String refreshToken
) {}
