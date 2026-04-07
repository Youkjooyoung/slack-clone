package com.slackclone.channel.dto;

import com.slackclone.domain.channel.entity.ChannelMember;
import com.slackclone.domain.channel.entity.ChannelRole;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ChannelMemberResponse(
        UUID userId,
        String email,
        String username,
        String displayName,
        String avatarUrl,
        ChannelRole role,
        OffsetDateTime lastReadAt
) {
    public static ChannelMemberResponse from(ChannelMember member) {
        return new ChannelMemberResponse(
                member.getUser().getId(),
                member.getUser().getEmail(),
                member.getUser().getUsername(),
                member.getUser().getDisplayName(),
                member.getUser().getAvatarUrl(),
                member.getRole(),
                member.getLastReadAt()
        );
    }
}
