package com.slackclone.user.controller;

import com.slackclone.common.response.ApiResponse;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.domain.user.entity.User;
import com.slackclone.user.dto.UpdateProfileRequest;
import com.slackclone.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final SecurityUtil securityUtil;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getMe() {
        return ResponseEntity.ok(ApiResponse.success(UserResponse.from(securityUtil.getCurrentUser())));
    }

    @Transactional
    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request) {
        User user = securityUtil.getCurrentUser();
        user.updateProfile(
                request.displayName(),
                request.avatarUrl(),
                request.statusMessage(),
                request.statusEmoji()
        );
        return ResponseEntity.ok(ApiResponse.success("프로필이 수정되었습니다.", UserResponse.from(user)));
    }
}
