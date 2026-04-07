package com.slackclone.domain.message.repository;

import com.slackclone.domain.message.entity.Message;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface MessageRepositoryCustom {

    List<Message> findByChannelIdBeforeCursor(UUID channelId, OffsetDateTime cursor, int size);
}
