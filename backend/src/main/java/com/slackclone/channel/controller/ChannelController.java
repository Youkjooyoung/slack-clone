package com.slackclone.channel.controller;

import com.slackclone.channel.dto.*;
import com.slackclone.channel.service.ChannelService;
import com.slackclone.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workspaces/{workspaceId}/channels")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;

    @PostMapping
    public ResponseEntity<ApiResponse<ChannelResponse>> create(
            @PathVariable UUID workspaceId,
            @Valid @RequestBody CreateChannelRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("채널이 생성되었습니다.", channelService.create(workspaceId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ChannelResponse>>> getChannels(
            @PathVariable UUID workspaceId) {
        return ResponseEntity.ok(ApiResponse.success(channelService.getChannels(workspaceId)));
    }

    @GetMapping("/{channelId}")
    public ResponseEntity<ApiResponse<ChannelResponse>> getOne(
            @PathVariable UUID workspaceId,
            @PathVariable UUID channelId) {
        return ResponseEntity.ok(ApiResponse.success(channelService.getOne(workspaceId, channelId)));
    }

    @PutMapping("/{channelId}")
    public ResponseEntity<ApiResponse<ChannelResponse>> update(
            @PathVariable UUID workspaceId,
            @PathVariable UUID channelId,
            @Valid @RequestBody UpdateChannelRequest request) {
        return ResponseEntity.ok(ApiResponse.success("채널이 수정되었습니다.", channelService.update(workspaceId, channelId, request)));
    }

    @DeleteMapping("/{channelId}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID workspaceId,
            @PathVariable UUID channelId) {
        channelService.delete(workspaceId, channelId);
        return ResponseEntity.ok(ApiResponse.success("채널이 삭제되었습니다."));
    }

    @PostMapping("/{channelId}/members")
    public ResponseEntity<ApiResponse<ChannelMemberResponse>> join(
            @PathVariable UUID workspaceId,
            @PathVariable UUID channelId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("채널에 참여했습니다.", channelService.join(workspaceId, channelId)));
    }

    @GetMapping("/{channelId}/members")
    public ResponseEntity<ApiResponse<List<ChannelMemberResponse>>> getMembers(
            @PathVariable UUID workspaceId,
            @PathVariable UUID channelId) {
        return ResponseEntity.ok(ApiResponse.success(channelService.getMembers(workspaceId, channelId)));
    }

    @DeleteMapping("/{channelId}/members/me")
    public ResponseEntity<ApiResponse<Void>> leave(
            @PathVariable UUID workspaceId,
            @PathVariable UUID channelId) {
        channelService.leave(workspaceId, channelId);
        return ResponseEntity.ok(ApiResponse.success("채널에서 나갔습니다."));
    }
}
