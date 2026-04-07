package com.slackclone.workspace.service;

import com.slackclone.common.exception.BusinessException;
import com.slackclone.common.exception.ErrorCode;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.domain.channel.entity.Channel;
import com.slackclone.domain.channel.entity.ChannelMember;
import com.slackclone.domain.channel.entity.ChannelRole;
import com.slackclone.domain.channel.repository.ChannelMemberRepository;
import com.slackclone.domain.channel.repository.ChannelRepository;
import com.slackclone.domain.user.entity.User;
import com.slackclone.domain.user.repository.UserRepository;
import com.slackclone.domain.workspace.entity.Workspace;
import com.slackclone.domain.workspace.entity.WorkspaceMember;
import com.slackclone.domain.workspace.entity.WorkspaceRole;
import com.slackclone.domain.workspace.repository.WorkspaceMemberRepository;
import com.slackclone.domain.workspace.repository.WorkspaceRepository;
import com.slackclone.workspace.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final ChannelRepository channelRepository;
    private final ChannelMemberRepository channelMemberRepository;
    private final UserRepository userRepository;
    private final SecurityUtil securityUtil;

    @Transactional
    public WorkspaceResponse create(CreateWorkspaceRequest request) {
        User currentUser = securityUtil.getCurrentUser();

        if (workspaceRepository.existsBySlug(request.slug())) {
            throw new BusinessException(ErrorCode.WORKSPACE_DUPLICATE_SLUG);
        }

        Workspace workspace = Workspace.builder()
                .name(request.name())
                .slug(request.slug())
                .description(request.description())
                .iconUrl(request.iconUrl())
                .owner(currentUser)
                .build();
        workspaceRepository.save(workspace);

        WorkspaceMember ownerMember = WorkspaceMember.builder()
                .workspace(workspace)
                .user(currentUser)
                .role(WorkspaceRole.OWNER)
                .build();
        workspaceMemberRepository.save(ownerMember);

        Channel general = Channel.builder()
                .workspace(workspace)
                .name("general")
                .description("일반 채널입니다.")
                .isPrivate(false)
                .createdBy(currentUser)
                .build();
        channelRepository.save(general);

        channelMemberRepository.save(ChannelMember.builder()
                .channel(general)
                .user(currentUser)
                .role(ChannelRole.ADMIN)
                .build());

        return WorkspaceResponse.of(workspace, WorkspaceRole.OWNER);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponse> getMyWorkspaces() {
        User currentUser = securityUtil.getCurrentUser();
        return workspaceMemberRepository.findAllByUserIdWithWorkspace(currentUser.getId())
                .stream()
                .map(m -> WorkspaceResponse.of(m.getWorkspace(), m.getRole()))
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkspaceResponse getOne(UUID workspaceId) {
        User currentUser = securityUtil.getCurrentUser();
        Workspace workspace = findWorkspaceOrThrow(workspaceId);
        WorkspaceMember member = findMemberOrThrow(workspaceId, currentUser.getId());
        return WorkspaceResponse.of(workspace, member.getRole());
    }

    @Transactional
    public WorkspaceResponse update(UUID workspaceId, UpdateWorkspaceRequest request) {
        User currentUser = securityUtil.getCurrentUser();
        Workspace workspace = findWorkspaceOrThrow(workspaceId);
        requireAdminOrAbove(workspaceId, currentUser.getId());

        workspace.updateInfo(request.name(), request.description(), request.iconUrl());
        return WorkspaceResponse.of(workspace, getMemberRole(workspaceId, currentUser.getId()));
    }

    @Transactional
    public void delete(UUID workspaceId) {
        User currentUser = securityUtil.getCurrentUser();
        Workspace workspace = findWorkspaceOrThrow(workspaceId);
        requireOwner(workspace, currentUser);
        workspace.softDelete();
    }

    @Transactional
    public WorkspaceMemberResponse invite(UUID workspaceId, InviteMemberRequest request) {
        User currentUser = securityUtil.getCurrentUser();
        findWorkspaceOrThrow(workspaceId);
        requireAdminOrAbove(workspaceId, currentUser.getId());

        User invitee = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, invitee.getId())) {
            throw new BusinessException(ErrorCode.WORKSPACE_ALREADY_MEMBER);
        }

        Workspace workspace = findWorkspaceOrThrow(workspaceId);
        WorkspaceMember newMember = WorkspaceMember.builder()
                .workspace(workspace)
                .user(invitee)
                .role(WorkspaceRole.MEMBER)
                .build();
        workspaceMemberRepository.save(newMember);
        return WorkspaceMemberResponse.from(newMember);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> getMembers(UUID workspaceId) {
        User currentUser = securityUtil.getCurrentUser();
        findMemberOrThrow(workspaceId, currentUser.getId());
        return workspaceMemberRepository.findAllByWorkspaceId(workspaceId)
                .stream()
                .map(WorkspaceMemberResponse::from)
                .toList();
    }

    @Transactional
    public void removeMember(UUID workspaceId, UUID targetUserId) {
        User currentUser = securityUtil.getCurrentUser();
        Workspace workspace = findWorkspaceOrThrow(workspaceId);

        if (targetUserId.equals(currentUser.getId())) {
            if (workspace.getOwner().getId().equals(currentUser.getId())) {
                throw new BusinessException(ErrorCode.WORKSPACE_OWNER_CANNOT_LEAVE);
            }
            WorkspaceMember self = findMemberOrThrow(workspaceId, currentUser.getId());
            self.softDelete();
            return;
        }

        requireAdminOrAbove(workspaceId, currentUser.getId());
        WorkspaceMember target = findMemberOrThrow(workspaceId, targetUserId);
        target.softDelete();
    }

    private Workspace findWorkspaceOrThrow(UUID workspaceId) {
        return workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.WORKSPACE_NOT_FOUND));
    }

    private WorkspaceMember findMemberOrThrow(UUID workspaceId, UUID userId) {
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.WORKSPACE_ACCESS_DENIED));
    }

    private WorkspaceRole getMemberRole(UUID workspaceId, UUID userId) {
        return findMemberOrThrow(workspaceId, userId).getRole();
    }

    private void requireAdminOrAbove(UUID workspaceId, UUID userId) {
        WorkspaceRole role = getMemberRole(workspaceId, userId);
        if (role == WorkspaceRole.MEMBER || role == WorkspaceRole.GUEST) {
            throw new BusinessException(ErrorCode.WORKSPACE_ADMIN_REQUIRED);
        }
    }

    private void requireOwner(Workspace workspace, User user) {
        if (!workspace.getOwner().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.WORKSPACE_ADMIN_REQUIRED);
        }
    }
}
