package com.slackclone.dm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EditDmRequest(
        @NotBlank @Size(max = 4000) String content
) {}
