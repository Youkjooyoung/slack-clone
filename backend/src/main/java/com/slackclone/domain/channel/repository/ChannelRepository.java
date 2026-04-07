package com.slackclone.domain.channel.repository;

import com.slackclone.domain.channel.entity.Channel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChannelRepository extends JpaRepository<Channel, UUID> {

    List<Channel> findAllByWorkspaceId(UUID workspaceId);
}
