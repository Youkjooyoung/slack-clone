package com.slackclone.reaction.controller;

import com.slackclone.common.response.ApiResponse;
import com.slackclone.reaction.dto.AddReactionRequest;
import com.slackclone.reaction.dto.ReactionResponse;
import com.slackclone.reaction.service.ReactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class ReactionController {

    private final ReactionService reactionService;

    @GetMapping("/messages/{messageId}/reactions")
    public ResponseEntity<ApiResponse<List<ReactionResponse>>> getMessageReactions(
            @PathVariable UUID messageId) {
        return ResponseEntity.ok(ApiResponse.success(reactionService.getMessageReactions(messageId)));
    }

    @PostMapping("/messages/{messageId}/reactions")
    public ResponseEntity<ApiResponse<ReactionResponse>> addToMessage(
            @PathVariable UUID messageId,
            @Valid @RequestBody AddReactionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                reactionService.addToMessage(messageId, request.emoji())));
    }

    @DeleteMapping("/messages/{messageId}/reactions/{emoji}")
    public ResponseEntity<ApiResponse<Void>> removeFromMessage(
            @PathVariable UUID messageId,
            @PathVariable String emoji) {
        reactionService.removeFromMessage(messageId, emoji);
        return ResponseEntity.ok(ApiResponse.success("반응이 삭제되었습니다."));
    }

    @PostMapping("/dm/{dmId}/reactions")
    public ResponseEntity<ApiResponse<ReactionResponse>> addToDm(
            @PathVariable UUID dmId,
            @Valid @RequestBody AddReactionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                reactionService.addToDm(dmId, request.emoji())));
    }

    @DeleteMapping("/dm/{dmId}/reactions/{emoji}")
    public ResponseEntity<ApiResponse<Void>> removeFromDm(
            @PathVariable UUID dmId,
            @PathVariable String emoji) {
        reactionService.removeFromDm(dmId, emoji);
        return ResponseEntity.ok(ApiResponse.success("반응이 삭제되었습니다."));
    }
}
