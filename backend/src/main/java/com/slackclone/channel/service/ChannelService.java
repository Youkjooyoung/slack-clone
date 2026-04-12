package com.slackclone.channel.service;

import com.slackclone.channel.dto.*;
import com.slackclone.common.exception.BusinessException;
import com.slackclone.common.exception.ErrorCode;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.domain.channel.entity.Channel;
import com.slackclone.domain.channel.entity.ChannelMember;
import com.slackclone.domain.channel.entity.ChannelRole;
import com.slackclone.domain.channel.repository.ChannelMemberRepository;
import com.slackclone.domain.channel.repository.ChannelRepository;
import com.slackclone.domain.user.entity.User;
import com.slackclone.domain.workspace.entity.Workspace;
import com.slackclone.domain.workspace.repository.WorkspaceMemberRepository;
import com.slackclone.domain.workspace.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository channelRepository;
    private final ChannelMemberRepository channelMemberRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final SecurityUtil securityUtil;

    @Transactional
    public ChannelResponse create(UUID workspaceId, CreateChannelRequest request) {
        User currentUser = securityUtil.getCurrentUser();
        Workspace workspace = findWorkspaceOrThrow(workspaceId);
        requireWorkspaceMember(workspaceId, currentUser.getId());

        Channel channel = Channel.builder()
                .workspace(workspace)
                .name(request.name())
                .description(request.description())
                .isPrivate(request.isPrivate())
                .createdBy(currentUser)
                .build();
        channelRepository.save(channel);

        ChannelMember adminMember = ChannelMember.builder()
                .channel(channel)
                .user(currentUser)
                .role(ChannelRole.ADMIN)
                .build();
        channelMemberRepository.save(adminMember);

        return ChannelResponse.of(channel, ChannelRole.ADMIN);
    }

    @Transactional(readOnly = true)
    public List<ChannelResponse> getChannels(UUID workspaceId) {
        User currentUser = securityUtil.getCurrentUser();
        requireWorkspaceMember(workspaceId, currentUser.getId());

        List<ChannelMember> myMemberships = channelMemberRepository
                .findAllByUserIdAndWorkspaceId(currentUser.getId(), workspaceId);

        return channelRepository.findAllByWorkspaceId(workspaceId).stream()
                .filter(ch -> !ch.isPrivate() ||
                        myMemberships.stream().anyMatch(m -> m.getChannel().getId().equals(ch.getId())))
                .map(ch -> {
                    ChannelRole role = myMemberships.stream()
                            .filter(m -> m.getChannel().getId().equals(ch.getId()))
                            .map(ChannelMember::getRole)
                            .findFirst()
                            .orElse(null);
                    return ChannelResponse.of(ch, role);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public ChannelResponse getOne(UUID workspaceId, UUID channelId) {
        User currentUser = securityUtil.getCurrentUser();
        requireWorkspaceMember(workspaceId, currentUser.getId());
        Channel channel = findChannelOrThrow(channelId);

        ChannelMember member = channelMemberRepository
                .findByChannelIdAndUserId(channelId, currentUser.getId())
                .orElse(null);

        if (channel.isPrivate() && member == null) {
            throw new BusinessException(ErrorCode.CHANNEL_ACCESS_DENIED);
        }

        return ChannelResponse.of(channel, member != null ? member.getRole() : null);
    }

    @Transactional
    public ChannelResponse update(UUID workspaceId, UUID channelId, UpdateChannelRequest request) {
        User currentUser = securityUtil.getCurrentUser();
        requireWorkspaceMember(workspaceId, currentUser.getId());
        Channel channel = findChannelOrThrow(channelId);
        requireChannelAdmin(channelId, currentUser.getId());

        channel.updateInfo(request.name(), request.description());
        ChannelMember member = channelMemberRepository
                .findByChannelIdAndUserId(channelId, currentUser.getId()).orElseThrow();
        return ChannelResponse.of(channel, member.getRole());
    }

    @Transactional
    public void delete(UUID workspaceId, UUID channelId) {
        User currentUser = securityUtil.getCurrentUser();
        requireWorkspaceMember(workspaceId, currentUser.getId());
        Channel channel = findChannelOrThrow(channelId);
        requireChannelAdmin(channelId, currentUser.getId());
        channel.softDelete();
    }

    @Transactional
    public ChannelMemberResponse join(UUID workspaceId, UUID channelId) {
        User currentUser = securityUtil.getCurrentUser();
        requireWorkspaceMember(workspaceId, currentUser.getId());
        Channel channel = findChannelOrThrow(channelId);

        if (channel.isPrivate()) {
            throw new BusinessException(ErrorCode.CHANNEL_ACCESS_DENIED);
        }
        if (channelMemberRepository.existsByChannelIdAndUserId(channelId, currentUser.getId())) {
            throw new BusinessException(ErrorCode.CHANNEL_ALREADY_MEMBER);
        }

        ChannelMember newMember = ChannelMember.builder()
                .channel(channel)
                .user(currentUser)
                .role(ChannelRole.MEMBER)
                .build();
        channelMemberRepository.save(newMember);
        return ChannelMemberResponse.from(newMember);
    }

    @Transactional(readOnly = true)
    public List<ChannelMemberResponse> getMembers(UUID workspaceId, UUID channelId) {
        User currentUser = securityUtil.getCurrentUser();
        requireWorkspaceMember(workspaceId, currentUser.getId());

        channelMemberRepository
                .findByChannelIdAndUserId(channelId, currentUser.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.CHANNEL_ACCESS_DENIED));

        return channelMemberRepository.findAllByChannelId(channelId)
                .stream()
                .map(ChannelMemberResponse::from)
                .toList();
    }

    @Transactional
    public void leave(UUID workspaceId, UUID channelId) {
        User currentUser = securityUtil.getCurrentUser();
        requireWorkspaceMember(workspaceId, currentUser.getId());
        ChannelMember member = channelMemberRepository
                .findByChannelIdAndUserId(channelId, currentUser.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.CHANNEL_MEMBER_NOT_FOUND));
        member.softDelete();
    }

    private Workspace findWorkspaceOrThrow(UUID workspaceId) {
        return workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.WORKSPACE_NOT_FOUND));
    }

    private Channel findChannelOrThrow(UUID channelId) {
        return channelRepository.findById(channelId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHANNEL_NOT_FOUND));
    }

    private void requireWorkspaceMember(UUID workspaceId, UUID userId) {
        if (!workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, userId)) {
            throw new BusinessException(ErrorCode.WORKSPACE_ACCESS_DENIED);
        }
    }

    private void requireChannelAdmin(UUID channelId, UUID userId) {
        ChannelMember member = channelMemberRepository
                .findByChannelIdAndUserId(channelId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHANNEL_ACCESS_DENIED));
        if (member.getRole() != ChannelRole.ADMIN) {
            throw new BusinessException(ErrorCode.CHANNEL_ADMIN_REQUIRED);
        }
    }
}
