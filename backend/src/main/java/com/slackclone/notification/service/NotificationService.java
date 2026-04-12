package com.slackclone.notification.service;

import com.slackclone.common.exception.BusinessException;
import com.slackclone.common.exception.ErrorCode;
import com.slackclone.domain.message.entity.Message;
import com.slackclone.domain.notification.entity.Notification;
import com.slackclone.domain.notification.entity.NotificationType;
import com.slackclone.domain.notification.entity.ReferenceType;
import com.slackclone.domain.notification.repository.NotificationRepository;
import com.slackclone.domain.user.entity.User;
import com.slackclone.domain.user.repository.UserRepository;
import com.slackclone.notification.dto.NotificationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Pattern MENTION_PATTERN = Pattern.compile("@(\\w+)");

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void processMentions(Message message) {
        if (message.getContent() == null) return;
        Matcher matcher = MENTION_PATTERN.matcher(message.getContent());

        while (matcher.find()) {
            String username = matcher.group(1);
            userRepository.findByUsername(username).ifPresent(mentioned -> {
                // 자기 자신 멘션 무시
                if (mentioned.getId().equals(message.getSender().getId())) return;

                String preview = message.getContent().length() > 100
                        ? message.getContent().substring(0, 100) + "..."
                        : message.getContent();
                String senderName = message.getSender().getDisplayName() != null
                        ? message.getSender().getDisplayName()
                        : message.getSender().getUsername();

                Notification notification = Notification.builder()
                        .user(mentioned)
                        .type(NotificationType.MENTION)
                        .title(senderName + "님이 나를 언급했습니다")
                        .content(preview)
                        .referenceId(message.getId())
                        .referenceType(ReferenceType.MESSAGE)
                        .build();
                notificationRepository.save(notification);

                // WebSocket 실시간 푸시
                messagingTemplate.convertAndSendToUser(
                        mentioned.getEmail(),
                        "/queue/notifications",
                        NotificationResponse.from(notification)
                );
            });
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(User user) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().map(NotificationResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public long countUnread(User user) {
        return notificationRepository.countByUserIdAndIsReadFalse(user.getId());
    }

    @Transactional
    public void markAsRead(java.util.UUID notificationId, User user) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MESSAGE_NOT_FOUND));
        if (!notification.getUser().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.MESSAGE_ACCESS_DENIED);
        }
        notification.markAsRead();
    }

    @Transactional
    public void markAllAsRead(User user) {
        notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .filter(n -> !n.isRead())
                .forEach(Notification::markAsRead);
    }
}
