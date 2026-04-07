package com.slackclone.workspace.dto;

import com.slackclone.domain.workspace.entity.WorkspaceMember;
import com.slackclone.domain.workspace.entity.WorkspaceRole;

import java.time.OffsetDateTime;
import java.util.UUID;

public record WorkspaceMemberResponse(
        UUID userId,
        String email,
        String username,
        String displayName,
        String avatarUrl,
        WorkspaceRole role,
        OffsetDateTime joinedAt
) {
    public static WorkspaceMemberResponse from(WorkspaceMember member) {
        return new WorkspaceMemberResponse(
                member.getUser().getId(),
                member.getUser().getEmail(),
                member.getUser().getUsername(),
                member.getUser().getDisplayName(),
                member.getUser().getAvatarUrl(),
                member.getRole(),
                member.getJoinedAt()
        );
    }
}
