package com.slackclone.domain.channel.repository;

import com.slackclone.domain.channel.entity.ChannelMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannelMemberRepository extends JpaRepository<ChannelMember, UUID> {

    boolean existsByChannelIdAndUserId(UUID channelId, UUID userId);

    Optional<ChannelMember> findByChannelIdAndUserId(UUID channelId, UUID userId);

    List<ChannelMember> findAllByChannelId(UUID channelId);

    @Query("SELECT cm FROM ChannelMember cm JOIN FETCH cm.channel WHERE cm.user.id = :userId AND cm.channel.workspace.id = :workspaceId")
    List<ChannelMember> findAllByUserIdAndWorkspaceId(UUID userId, UUID workspaceId);
}
