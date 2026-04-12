package com.slackclone.reaction.service;

import com.slackclone.common.exception.BusinessException;
import com.slackclone.common.exception.ErrorCode;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.domain.message.entity.DirectMessage;
import com.slackclone.domain.message.entity.Message;
import com.slackclone.domain.message.repository.DirectMessageRepository;
import com.slackclone.domain.message.repository.MessageRepository;
import com.slackclone.domain.reaction.entity.Reaction;
import com.slackclone.domain.reaction.repository.ReactionRepository;
import com.slackclone.domain.user.entity.User;
import com.slackclone.reaction.dto.ReactionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReactionService {

    private final ReactionRepository reactionRepository;
    private final MessageRepository messageRepository;
    private final DirectMessageRepository dmRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final SecurityUtil securityUtil;

    @Transactional
    public ReactionResponse addToMessage(UUID messageId, String emoji) {
        User user = securityUtil.getCurrentUser();

        if (reactionRepository.existsByMessageIdAndUserIdAndEmoji(messageId, user.getId(), emoji)) {
            throw new BusinessException(ErrorCode.REACTION_ALREADY_EXISTS);
        }

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MESSAGE_NOT_FOUND));

        Reaction reaction = Reaction.builder()
                .message(message)
                .user(user)
                .emoji(emoji)
                .build();
        reactionRepository.save(reaction);

        ReactionResponse response = ReactionResponse.from(reaction);
        messagingTemplate.convertAndSend(
                "/topic/channel/" + message.getChannel().getId() + "/reactions", response);

        return response;
    }

    @Transactional
    public void removeFromMessage(UUID messageId, String emoji) {
        User user = securityUtil.getCurrentUser();
        Reaction reaction = reactionRepository
                .findByMessageIdAndUserIdAndEmoji(messageId, user.getId(), emoji)
                .orElseThrow(() -> new BusinessException(ErrorCode.REACTION_NOT_FOUND));

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MESSAGE_NOT_FOUND));

        reaction.softDelete();

        messagingTemplate.convertAndSend(
                "/topic/channel/" + message.getChannel().getId() + "/reactions/remove",
                ReactionResponse.from(reaction));
    }

    @Transactional(readOnly = true)
    public List<ReactionResponse> getMessageReactions(UUID messageId) {
        return reactionRepository.findAllByMessageId(messageId)
                .stream().map(ReactionResponse::from).toList();
    }

    @Transactional
    public ReactionResponse addToDm(UUID dmId, String emoji) {
        User user = securityUtil.getCurrentUser();
        DirectMessage dm = dmRepository.findById(dmId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DM_NOT_FOUND));

        if (!dm.getSender().getId().equals(user.getId()) && !dm.getReceiver().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.DM_ACCESS_DENIED);
        }

        Reaction reaction = Reaction.builder()
                .directMessage(dm)
                .user(user)
                .emoji(emoji)
                .build();
        reactionRepository.save(reaction);

        ReactionResponse response = ReactionResponse.from(reaction);

        String pair = dm.getSender().getId().compareTo(dm.getReceiver().getId()) < 0
                ? dm.getSender().getId() + "_" + dm.getReceiver().getId()
                : dm.getReceiver().getId() + "_" + dm.getSender().getId();

        messagingTemplate.convertAndSend(
                "/topic/dm/" + dm.getWorkspace().getId() + "/" + pair + "/reactions", response);

        return response;
    }

    @Transactional
    public void removeFromDm(UUID dmId, String emoji) {
        User user = securityUtil.getCurrentUser();
        Reaction reaction = reactionRepository
                .findByDirectMessageIdAndUserIdAndEmoji(dmId, user.getId(), emoji)
                .orElseThrow(() -> new BusinessException(ErrorCode.REACTION_NOT_FOUND));

        DirectMessage dm = dmRepository.findById(dmId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DM_NOT_FOUND));

        if (!dm.getSender().getId().equals(user.getId()) && !dm.getReceiver().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.DM_ACCESS_DENIED);
        }

        reaction.softDelete();

        String pair = dm.getSender().getId().compareTo(dm.getReceiver().getId()) < 0
                ? dm.getSender().getId() + "_" + dm.getReceiver().getId()
                : dm.getReceiver().getId() + "_" + dm.getSender().getId();

        messagingTemplate.convertAndSend(
                "/topic/dm/" + dm.getWorkspace().getId() + "/" + pair + "/reactions/remove",
                ReactionResponse.from(reaction));
    }
}
