package com.slackclone.reaction.dto;

import com.slackclone.domain.reaction.entity.Reaction;

import java.util.UUID;

public record ReactionResponse(
        UUID id,
        UUID messageId,
        UUID directMessageId,
        UUID userId,
        String username,
        String emoji
) {
    public static ReactionResponse from(Reaction r) {
        return new ReactionResponse(
                r.getId(),
                r.getMessage() != null ? r.getMessage().getId() : null,
                r.getDirectMessage() != null ? r.getDirectMessage().getId() : null,
                r.getUser().getId(),
                r.getUser().getUsername(),
                r.getEmoji()
        );
    }
}
