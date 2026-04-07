package com.slackclone.message.service;

import com.slackclone.channel.dto.ChannelMemberResponse;
import com.slackclone.common.exception.BusinessException;
import com.slackclone.common.exception.ErrorCode;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.domain.channel.entity.Channel;
import com.slackclone.domain.channel.repository.ChannelMemberRepository;
import com.slackclone.domain.channel.repository.ChannelRepository;
import com.slackclone.domain.message.entity.Message;
import com.slackclone.domain.message.repository.MessageRepository;
import com.slackclone.domain.user.entity.User;
import com.slackclone.domain.workspace.repository.WorkspaceMemberRepository;
import com.slackclone.message.dto.MessagePageResponse;
import com.slackclone.message.dto.MessageResponse;
import com.slackclone.message.dto.SendMessageRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class MessageService {

    private static final int PAGE_SIZE = 50;
    private static final String READ_KEY_PREFIX = "channel:read:";

    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final ChannelMemberRepository channelMemberRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final SecurityUtil securityUtil;

    @Transactional
    public MessageResponse sendMessage(UUID workspaceId, UUID channelId,
                                       SendMessageRequest request, String senderEmail) {
        User sender = securityUtil.getCurrentUser();
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHANNEL_NOT_FOUND));

        if (!workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, sender.getId())) {
            throw new BusinessException(ErrorCode.WORKSPACE_ACCESS_DENIED);
        }
        if (!channelMemberRepository.existsByChannelIdAndUserId(channelId, sender.getId())) {
            throw new BusinessException(ErrorCode.CHANNEL_ACCESS_DENIED);
        }

        Message parent = null;
        if (request.parentId() != null) {
            parent = messageRepository.findById(UUID.fromString(request.parentId()))
                    .orElseThrow(() -> new BusinessException(ErrorCode.MESSAGE_NOT_FOUND));
        }

        Message message = Message.builder()
                .channel(channel)
                .sender(sender)
                .parent(parent)
                .content(request.content())
                .build();
        messageRepository.save(message);

        MessageResponse response = MessageResponse.from(message);

        messagingTemplate.convertAndSend("/topic/channel/" + channelId, response);

        return response;
    }

    @Transactional(readOnly = true)
    public MessagePageResponse getMessages(UUID workspaceId, UUID channelId,
                                           String cursorStr, String senderEmail) {
        User user = securityUtil.getCurrentUser();

        if (!workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, user.getId())) {
            throw new BusinessException(ErrorCode.WORKSPACE_ACCESS_DENIED);
        }
        if (!channelMemberRepository.existsByChannelIdAndUserId(channelId, user.getId())) {
            throw new BusinessException(ErrorCode.CHANNEL_ACCESS_DENIED);
        }

        OffsetDateTime cursor = cursorStr != null ? OffsetDateTime.parse(cursorStr) : null;
        List<Message> messages = messageRepository.findByChannelIdBeforeCursor(
                channelId, cursor, PAGE_SIZE + 1);

        boolean hasMore = messages.size() > PAGE_SIZE;
        if (hasMore) messages = messages.subList(0, PAGE_SIZE);

        String nextCursor = hasMore ? messages.get(messages.size() - 1)
                .getCreatedAt().toString() : null;

        return new MessagePageResponse(
                messages.stream().map(MessageResponse::from).toList(),
                hasMore,
                nextCursor
        );
    }

    @Transactional
    public MessageResponse editMessage(UUID messageId, String content) {
        User user = securityUtil.getCurrentUser();
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MESSAGE_NOT_FOUND));

        if (!message.getSender().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.MESSAGE_ACCESS_DENIED);
        }

        message.editContent(content);
        MessageResponse response = MessageResponse.from(message);
        messagingTemplate.convertAndSend(
                "/topic/channel/" + message.getChannel().getId() + "/update", response);
        return response;
    }

    @Transactional
    public void deleteMessage(UUID messageId) {
        User user = securityUtil.getCurrentUser();
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MESSAGE_NOT_FOUND));

        if (!message.getSender().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.MESSAGE_ACCESS_DENIED);
        }

        message.softDelete();
        messagingTemplate.convertAndSend(
                "/topic/channel/" + message.getChannel().getId() + "/delete",
                messageId.toString());
    }

    public void markAsRead(UUID channelId) {
        User user = securityUtil.getCurrentUser();
        String key = READ_KEY_PREFIX + channelId + ":" + user.getId();
        redisTemplate.opsForValue().set(key, OffsetDateTime.now().toString(),
                7, TimeUnit.DAYS);
    }
}
