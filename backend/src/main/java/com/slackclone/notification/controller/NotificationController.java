package com.slackclone.notification.controller;

import com.slackclone.common.response.ApiResponse;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.notification.dto.NotificationResponse;
import com.slackclone.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final SecurityUtil securityUtil;

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getMyNotifications() {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.getMyNotifications(securityUtil.getCurrentUser())));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getUnreadCount() {
        long count = notificationService.countUnread(securityUtil.getCurrentUser());
        return ResponseEntity.ok(ApiResponse.success(Map.of("count", count)));
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(@PathVariable UUID notificationId) {
        notificationService.markAsRead(notificationId, securityUtil.getCurrentUser());
        return ResponseEntity.ok(ApiResponse.success("읽음 처리되었습니다."));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead() {
        notificationService.markAllAsRead(securityUtil.getCurrentUser());
        return ResponseEntity.ok(ApiResponse.success("모두 읽음 처리되었습니다."));
    }
}
