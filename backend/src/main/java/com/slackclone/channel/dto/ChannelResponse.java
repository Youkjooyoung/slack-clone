package com.slackclone.channel.dto;

import com.slackclone.domain.channel.entity.Channel;
import com.slackclone.domain.channel.entity.ChannelRole;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ChannelResponse(
        UUID id,
        UUID workspaceId,
        String name,
        String description,
        boolean isPrivate,
        boolean isArchived,
        UUID createdBy,
        ChannelRole myRole,
        OffsetDateTime createdAt
) {
    public static ChannelResponse of(Channel channel, ChannelRole myRole) {
        return new ChannelResponse(
                channel.getId(),
                channel.getWorkspace().getId(),
                channel.getName(),
                channel.getDescription(),
                channel.isPrivate(),
                channel.isArchived(),
                channel.getCreatedBy().getId(),
                myRole,
                channel.getCreatedAt()
        );
    }
}
