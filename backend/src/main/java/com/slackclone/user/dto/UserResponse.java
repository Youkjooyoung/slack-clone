package com.slackclone.user.dto;

import com.slackclone.domain.user.entity.User;

import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String username,
        String displayName,
        String avatarUrl,
        String statusMessage,
        String statusEmoji,
        boolean isOnline
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getStatusMessage(),
                user.getStatusEmoji(),
                user.isOnline()
        );
    }
}
