package com.slackclone.dm.service;

import com.slackclone.common.exception.BusinessException;
import com.slackclone.common.exception.ErrorCode;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.dm.dto.DmPageResponse;
import com.slackclone.dm.dto.DmResponse;
import com.slackclone.dm.dto.SendDmRequest;
import com.slackclone.domain.message.entity.DirectMessage;
import com.slackclone.domain.message.repository.DirectMessageRepository;
import com.slackclone.domain.user.entity.User;
import com.slackclone.domain.user.repository.UserRepository;
import com.slackclone.domain.workspace.entity.Workspace;
import com.slackclone.domain.workspace.repository.WorkspaceMemberRepository;
import com.slackclone.domain.workspace.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DirectMessageService {

    private static final int PAGE_SIZE = 50;

    private final DirectMessageRepository dmRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final SecurityUtil securityUtil;

    @Transactional
    public DmResponse sendDm(UUID workspaceId, UUID receiverId, SendDmRequest request, String senderEmail) {
        User sender = (senderEmail != null)
                ? userRepository.findByEmail(senderEmail)
                        .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND))
                : securityUtil.getCurrentUser();

        validateWorkspaceMember(workspaceId, sender.getId());
        validateWorkspaceMember(workspaceId, receiverId);

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.WORKSPACE_NOT_FOUND));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        DirectMessage dm = DirectMessage.builder()
                .workspace(workspace)
                .sender(sender)
                .receiver(receiver)
                .content(request.content())
                .build();
        dmRepository.save(dm);

        DmResponse response = DmResponse.from(dm);

        // 두 사람 모두에게 WebSocket 전송
        String topic = dmTopic(workspaceId, sender.getId(), receiverId);
        messagingTemplate.convertAndSend(topic, response);

        // 수신자에게 unread DM 이벤트 발송
        messagingTemplate.convertAndSendToUser(
                receiver.getEmail(),
                "/queue/unread",
                java.util.Map.of("type", "DM",
                        "fromUserId", sender.getId().toString(),
                        "workspaceId", workspaceId.toString()));

        return response;
    }

    @Transactional(readOnly = true)
    public DmPageResponse getDms(UUID workspaceId, UUID targetUserId, String cursorStr) {
        User user = securityUtil.getCurrentUser();
        validateWorkspaceMember(workspaceId, user.getId());

        OffsetDateTime cursor = cursorStr != null ? OffsetDateTime.parse(cursorStr) : null;
        List<DirectMessage> messages = cursor != null
                ? dmRepository.findConversationBefore(
                        workspaceId, user.getId(), targetUserId, cursor,
                        PageRequest.of(0, PAGE_SIZE + 1))
                : dmRepository.findConversation(
                        workspaceId, user.getId(), targetUserId,
                        PageRequest.of(0, PAGE_SIZE + 1));

        boolean hasMore = messages.size() > PAGE_SIZE;
        if (hasMore) messages = messages.subList(0, PAGE_SIZE);

        String nextCursor = hasMore
                ? messages.get(messages.size() - 1).getCreatedAt().toString()
                : null;

        return new DmPageResponse(
                messages.stream().map(DmResponse::from).toList(),
                hasMore,
                nextCursor
        );
    }

    @Transactional
    public DmResponse editDm(UUID dmId, String content) {
        User user = securityUtil.getCurrentUser();
        DirectMessage dm = dmRepository.findById(dmId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DM_NOT_FOUND));

        if (!dm.getSender().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.DM_ACCESS_DENIED);
        }

        dm.editContent(content);
        DmResponse response = DmResponse.from(dm);

        String topic = dmTopic(dm.getWorkspace().getId(), dm.getSender().getId(), dm.getReceiver().getId());
        messagingTemplate.convertAndSend(topic + "/update", response);

        return response;
    }

    @Transactional
    public void deleteDm(UUID dmId) {
        User user = securityUtil.getCurrentUser();
        DirectMessage dm = dmRepository.findById(dmId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DM_NOT_FOUND));

        if (!dm.getSender().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.DM_ACCESS_DENIED);
        }

        dm.softDelete();
        String topic = dmTopic(dm.getWorkspace().getId(), dm.getSender().getId(), dm.getReceiver().getId());
        messagingTemplate.convertAndSend(topic + "/delete", dmId.toString());
    }

    private void validateWorkspaceMember(UUID workspaceId, UUID userId) {
        if (!workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, userId)) {
            throw new BusinessException(ErrorCode.WORKSPACE_ACCESS_DENIED);
        }
    }

    /** 두 userId를 정렬해서 결정론적 토픽 경로 생성 */
    public static String dmTopic(UUID workspaceId, UUID userId1, UUID userId2) {
        String a = userId1.toString();
        String b = userId2.toString();
        String pair = a.compareTo(b) < 0 ? a + "_" + b : b + "_" + a;
        return "/topic/dm/" + workspaceId + "/" + pair;
    }
}
