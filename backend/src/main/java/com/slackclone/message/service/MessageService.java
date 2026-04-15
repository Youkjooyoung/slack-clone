package com.slackclone.message.service;

import com.slackclone.common.exception.BusinessException;
import com.slackclone.common.exception.ErrorCode;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.domain.channel.entity.Channel;
import com.slackclone.domain.channel.entity.ChannelMember;
import com.slackclone.domain.channel.entity.ChannelRole;
import com.slackclone.domain.channel.repository.ChannelMemberRepository;
import com.slackclone.domain.channel.repository.ChannelRepository;
import com.slackclone.domain.message.entity.Message;
import com.slackclone.domain.message.repository.MessageRepository;
import com.slackclone.domain.notification.entity.Notification;
import com.slackclone.domain.notification.entity.NotificationType;
import com.slackclone.domain.notification.repository.NotificationRepository;
import com.slackclone.domain.user.entity.User;
import com.slackclone.domain.user.repository.UserRepository;
import com.slackclone.domain.workspace.repository.WorkspaceMemberRepository;
import com.slackclone.message.dto.MessagePageResponse;
import com.slackclone.message.dto.MessageResponse;
import com.slackclone.message.dto.SendMessageRequest;
import com.slackclone.notification.dto.NotificationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class MessageService {

    private static final int PAGE_SIZE = 50;
    private static final String READ_KEY_PREFIX = "channel:read:";
    private static final Pattern MENTION_PATTERN = Pattern.compile("@([a-zA-Z0-9가-힣_]+)");

    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final ChannelMemberRepository channelMemberRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final SecurityUtil securityUtil;

    @Transactional
    public MessageResponse sendMessage(UUID workspaceId, UUID channelId,
                                       SendMessageRequest request, String senderEmail) {
        User sender = (senderEmail != null)
                ? userRepository.findByEmail(senderEmail)
                        .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND))
                : securityUtil.getCurrentUser();
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

        processMentions(channelId, message);

        MessageResponse response = MessageResponse.from(message);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, response);

        notifyChannelUnread(channelId, workspaceId, sender.getId());

        return response;
    }

    @Transactional
    public MessagePageResponse getMessages(UUID workspaceId, UUID channelId,
                                           String cursorStr, String senderEmail) {
        User user = securityUtil.getCurrentUser();

        if (!workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, user.getId())) {
            throw new BusinessException(ErrorCode.WORKSPACE_ACCESS_DENIED);
        }
        if (!channelMemberRepository.existsByChannelIdAndUserId(channelId, user.getId())) {
            Channel channel = channelRepository.findById(channelId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.CHANNEL_NOT_FOUND));
            if (channel.isPrivate() || !channel.getWorkspace().getId().equals(workspaceId)) {
                throw new BusinessException(ErrorCode.CHANNEL_ACCESS_DENIED);
            }
            channelMemberRepository.save(ChannelMember.builder()
                    .channel(channel)
                    .user(user)
                    .role(ChannelRole.MEMBER)
                    .build());
        }

        OffsetDateTime cursor = cursorStr != null ? OffsetDateTime.parse(cursorStr) : null;
        List<Message> messages = messageRepository.findByChannelIdBeforeCursor(
                channelId, cursor, PAGE_SIZE + 1);

        boolean hasMore = messages.size() > PAGE_SIZE;
        if (hasMore) messages = messages.subList(0, PAGE_SIZE);

        String nextCursor = hasMore ? messages.get(messages.size() - 1)
                .getCreatedAt().toString() : null;

        List<UUID> messageIds = messages.stream().map(Message::getId).toList();
        Map<UUID, Integer> replyCounts = new HashMap<>();
        if (!messageIds.isEmpty()) {
            messageRepository.countRepliesByParentIds(messageIds).forEach(row ->
                    replyCounts.put((UUID) row[0], ((Long) row[1]).intValue()));
        }

        return new MessagePageResponse(
                messages.stream()
                        .map(m -> MessageResponse.from(m, replyCounts.getOrDefault(m.getId(), 0)))
                        .toList(),
                hasMore,
                nextCursor
        );
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> searchMessages(UUID workspaceId, UUID channelId, String keyword) {
        User user = securityUtil.getCurrentUser();
        if (!workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, user.getId())) {
            throw new BusinessException(ErrorCode.WORKSPACE_ACCESS_DENIED);
        }
        if (!channelMemberRepository.existsByChannelIdAndUserId(channelId, user.getId())) {
            throw new BusinessException(ErrorCode.CHANNEL_ACCESS_DENIED);
        }
        return messageRepository.searchByChannelIdAndKeyword(channelId, keyword, 50)
                .stream().map(MessageResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getReplies(UUID messageId) {
        User user = securityUtil.getCurrentUser();
        Message parent = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MESSAGE_NOT_FOUND));

        if (!workspaceMemberRepository.existsByWorkspaceIdAndUserId(
                parent.getChannel().getWorkspace().getId(), user.getId())) {
            throw new BusinessException(ErrorCode.WORKSPACE_ACCESS_DENIED);
        }

        return messageRepository.findRepliesByParentId(messageId)
                .stream().map(MessageResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getUnreadCounts(UUID workspaceId) {
        User user = securityUtil.getCurrentUser();
        List<ChannelMember> memberships =
                channelMemberRepository.findAllByUserIdAndWorkspaceId(user.getId(), workspaceId);

        Map<String, Long> result = new HashMap<>();
        for (ChannelMember membership : memberships) {
            UUID channelId = membership.getChannel().getId();
            String key = READ_KEY_PREFIX + channelId + ":" + user.getId();
            Object lastRead = redisTemplate.opsForValue().get(key);
            if (lastRead == null) continue;

            OffsetDateTime since = OffsetDateTime.parse(lastRead.toString());
            long count = messageRepository.countUnreadMessages(channelId, since, user.getId());
            if (count > 0) result.put(channelId.toString(), count);
        }
        return result;
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

    public void markAsRead(UUID channelId) {
        User user = securityUtil.getCurrentUser();
        String key = READ_KEY_PREFIX + channelId + ":" + user.getId();
        redisTemplate.opsForValue().set(key, OffsetDateTime.now().toString(),
                7, TimeUnit.DAYS);
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

    private void notifyChannelUnread(UUID channelId, UUID workspaceId, UUID senderId) {
        channelMemberRepository.findAllByChannelId(channelId).forEach(cm -> {
            User member = cm.getUser();
            if (!member.getId().equals(senderId)) {
                messagingTemplate.convertAndSendToUser(
                        member.getEmail(),
                        "/queue/unread",
                        Map.of("type", "CHANNEL",
                                "channelId", channelId.toString(),
                                "workspaceId", workspaceId.toString()));
            }
        });
    }

    private void processMentions(UUID channelId, Message message) {
        String content = message.getContent();
        if (content == null || !content.contains("@")) return;

        Matcher matcher = MENTION_PATTERN.matcher(content);
        Set<String> mentionedNames = new HashSet<>();
        while (matcher.find()) {
            mentionedNames.add(matcher.group(1));
        }
        if (mentionedNames.isEmpty()) return;

        List<ChannelMember> members = channelMemberRepository.findAllByChannelId(channelId);

        for (ChannelMember cm : members) {
            User targetUser = cm.getUser();
            boolean isMentioned = mentionedNames.contains(targetUser.getUsername())
                    || (targetUser.getDisplayName() != null && mentionedNames.contains(targetUser.getDisplayName()));

            if (isMentioned && !targetUser.getId().equals(message.getSender().getId())) {
                Notification notification = Notification.builder()
                        .user(targetUser)
                        .type(NotificationType.MENTION)
                        .title("멘션 알림")
                        .content(message.getSender().getUsername() + "님이 #" + message.getChannel().getName() + " 채널에서 멘션했습니다.")
                        .isRead(false)
                        .build();

                notificationRepository.save(notification);
                messagingTemplate.convertAndSendToUser(
                        targetUser.getId().toString(),
                        "/queue/notifications",
                        NotificationResponse.from(notification));
            }
        }
    }
}
