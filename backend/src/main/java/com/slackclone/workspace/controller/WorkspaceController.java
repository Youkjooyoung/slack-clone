package com.slackclone.workspace.controller;

import com.slackclone.common.response.ApiResponse;
import com.slackclone.workspace.dto.*;
import com.slackclone.workspace.service.WorkspaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    @PostMapping
    public ResponseEntity<ApiResponse<WorkspaceResponse>> create(
            @Valid @RequestBody CreateWorkspaceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("워크스페이스가 생성되었습니다.", workspaceService.create(request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<WorkspaceResponse>>> getMyWorkspaces() {
        return ResponseEntity.ok(ApiResponse.success(workspaceService.getMyWorkspaces()));
    }

    @GetMapping("/{workspaceId}")
    public ResponseEntity<ApiResponse<WorkspaceResponse>> getOne(
            @PathVariable UUID workspaceId) {
        return ResponseEntity.ok(ApiResponse.success(workspaceService.getOne(workspaceId)));
    }

    @PutMapping("/{workspaceId}")
    public ResponseEntity<ApiResponse<WorkspaceResponse>> update(
            @PathVariable UUID workspaceId,
            @Valid @RequestBody UpdateWorkspaceRequest request) {
        return ResponseEntity.ok(ApiResponse.success("워크스페이스가 수정되었습니다.", workspaceService.update(workspaceId, request)));
    }

    @DeleteMapping("/{workspaceId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID workspaceId) {
        workspaceService.delete(workspaceId);
        return ResponseEntity.ok(ApiResponse.success("워크스페이스가 삭제되었습니다."));
    }

    @PostMapping("/{workspaceId}/members")
    public ResponseEntity<ApiResponse<WorkspaceMemberResponse>> invite(
            @PathVariable UUID workspaceId,
            @Valid @RequestBody InviteMemberRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("멤버를 초대했습니다.", workspaceService.invite(workspaceId, request)));
    }

    @GetMapping("/{workspaceId}/members")
    public ResponseEntity<ApiResponse<List<WorkspaceMemberResponse>>> getMembers(
            @PathVariable UUID workspaceId) {
        return ResponseEntity.ok(ApiResponse.success(workspaceService.getMembers(workspaceId)));
    }

    @DeleteMapping("/{workspaceId}/members/{userId}")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable UUID workspaceId,
            @PathVariable UUID userId) {
        workspaceService.removeMember(workspaceId, userId);
        return ResponseEntity.ok(ApiResponse.success("멤버가 제거되었습니다."));
    }
}
