package com.slackclone.domain.workspace.repository;

import com.slackclone.domain.workspace.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {

    boolean existsBySlug(String slug);

    Optional<Workspace> findBySlug(String slug);
}
