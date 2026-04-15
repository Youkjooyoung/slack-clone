package com.slackclone.message.controller;

import com.slackclone.common.response.ApiResponse;
import com.slackclone.message.dto.EditMessageRequest;
import com.slackclone.message.dto.MessagePageResponse;
import com.slackclone.message.dto.MessageResponse;
import com.slackclone.message.dto.SendMessageRequest;
import com.slackclone.message.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @GetMapping("/api/workspaces/{workspaceId}/channels/{channelId}/messages")
    public ResponseEntity<ApiResponse<MessagePageResponse>> getMessages(
            @PathVariable UUID workspaceId,
            @PathVariable UUID channelId,
            @RequestParam(required = false) String cursor) {
        return ResponseEntity.ok(
                ApiResponse.success(messageService.getMessages(workspaceId, channelId, cursor, null)));
    }

    @PutMapping("/api/messages/{messageId}")
    public ResponseEntity<ApiResponse<MessageResponse>> editMessage(
            @PathVariable UUID messageId,
            @Valid @RequestBody EditMessageRequest request) {
        return ResponseEntity.ok(
                ApiResponse.success("메시지가 수정되었습니다.", messageService.editMessage(messageId, request.content())));
    }

    @DeleteMapping("/api/messages/{messageId}")
    public ResponseEntity<ApiResponse<Void>> deleteMessage(@PathVariable UUID messageId) {
        messageService.deleteMessage(messageId);
        return ResponseEntity.ok(ApiResponse.success("메시지가 삭제되었습니다."));
    }

    @GetMapping("/api/workspaces/{workspaceId}/channels/{channelId}/messages/search")
    public ResponseEntity<ApiResponse<List<MessageResponse>>> searchMessages(
            @PathVariable UUID workspaceId,
            @PathVariable UUID channelId,
            @RequestParam String q) {
        return ResponseEntity.ok(ApiResponse.success(messageService.searchMessages(workspaceId, channelId, q)));
    }

    @GetMapping("/api/messages/{messageId}/replies")
    public ResponseEntity<ApiResponse<List<MessageResponse>>> getReplies(
            @PathVariable UUID messageId) {
        return ResponseEntity.ok(ApiResponse.success(messageService.getReplies(messageId)));
    }

    @PostMapping("/api/workspaces/{workspaceId}/channels/{channelId}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable UUID workspaceId,
            @PathVariable UUID channelId) {
        messageService.markAsRead(channelId);
        return ResponseEntity.ok(ApiResponse.success("읽음 처리되었습니다."));
    }

    @GetMapping("/api/workspaces/{workspaceId}/channels/unread")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getUnreadCounts(
            @PathVariable UUID workspaceId) {
        return ResponseEntity.ok(ApiResponse.success(messageService.getUnreadCounts(workspaceId)));
    }

    @MessageMapping("/channel/{workspaceId}/{channelId}/send")
    public void sendMessage(
            @DestinationVariable UUID workspaceId,
            @DestinationVariable UUID channelId,
            @Payload @Valid SendMessageRequest request,
            Principal principal) {
        messageService.sendMessage(workspaceId, channelId, request,
                principal != null ? principal.getName() : null);
    }
}
