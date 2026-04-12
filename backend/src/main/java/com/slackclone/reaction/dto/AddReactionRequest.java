package com.slackclone.reaction.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddReactionRequest(
        @NotBlank @Size(max = 50) String emoji
) {}
