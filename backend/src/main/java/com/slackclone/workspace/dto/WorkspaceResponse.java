package com.slackclone.workspace.dto;

import com.slackclone.domain.workspace.entity.Workspace;
import com.slackclone.domain.workspace.entity.WorkspaceRole;

import java.time.OffsetDateTime;
import java.util.UUID;

public record WorkspaceResponse(
        UUID id,
        String name,
        String slug,
        String description,
        String iconUrl,
        UUID ownerId,
        WorkspaceRole myRole,
        OffsetDateTime createdAt
) {
    public static WorkspaceResponse of(Workspace workspace, WorkspaceRole myRole) {
        return new WorkspaceResponse(
                workspace.getId(),
                workspace.getName(),
                workspace.getSlug(),
                workspace.getDescription(),
                workspace.getIconUrl(),
                workspace.getOwner().getId(),
                myRole,
                workspace.getCreatedAt()
        );
    }
}
