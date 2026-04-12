package com.slackclone.dm.controller;

import com.slackclone.common.response.ApiResponse;
import com.slackclone.dm.dto.DmPageResponse;
import com.slackclone.dm.dto.DmResponse;
import com.slackclone.dm.dto.EditDmRequest;
import com.slackclone.dm.dto.SendDmRequest;
import com.slackclone.dm.service.DirectMessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class DirectMessageController {

    private final DirectMessageService dmService;

    @GetMapping("/api/workspaces/{workspaceId}/dm/{targetUserId}/messages")
    public ResponseEntity<ApiResponse<DmPageResponse>> getDms(
            @PathVariable UUID workspaceId,
            @PathVariable UUID targetUserId,
            @RequestParam(required = false) String cursor) {
        return ResponseEntity.ok(ApiResponse.success(dmService.getDms(workspaceId, targetUserId, cursor)));
    }

    @PutMapping("/api/dm/{dmId}")
    public ResponseEntity<ApiResponse<DmResponse>> editDm(
            @PathVariable UUID dmId,
            @Valid @RequestBody EditDmRequest request) {
        return ResponseEntity.ok(ApiResponse.success("메시지가 수정되었습니다.", dmService.editDm(dmId, request.content())));
    }

    @DeleteMapping("/api/dm/{dmId}")
    public ResponseEntity<ApiResponse<Void>> deleteDm(@PathVariable UUID dmId) {
        dmService.deleteDm(dmId);
        return ResponseEntity.ok(ApiResponse.success("메시지가 삭제되었습니다."));
    }

    @MessageMapping("/dm/{workspaceId}/{receiverId}/send")
    public void sendDm(
            @DestinationVariable UUID workspaceId,
            @DestinationVariable UUID receiverId,
            @Payload @Valid SendDmRequest request,
            Principal principal) {
        dmService.sendDm(workspaceId, receiverId, request,
                principal != null ? principal.getName() : null);
    }
}
