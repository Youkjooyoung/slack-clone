package com.slackclone.domain.workspace.repository;

import com.slackclone.domain.workspace.entity.WorkspaceMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, UUID> {

    boolean existsByWorkspaceIdAndUserId(UUID workspaceId, UUID userId);

    Optional<WorkspaceMember> findByWorkspaceIdAndUserId(UUID workspaceId, UUID userId);

    List<WorkspaceMember> findAllByWorkspaceId(UUID workspaceId);

    @Query("SELECT wm FROM WorkspaceMember wm JOIN FETCH wm.workspace WHERE wm.user.id = :userId")
    List<WorkspaceMember> findAllByUserIdWithWorkspace(UUID userId);

    @Query("SELECT wm.user.id FROM WorkspaceMember wm WHERE wm.workspace.id = :workspaceId")
    List<UUID> findUserIdsByWorkspaceId(UUID workspaceId);
}
