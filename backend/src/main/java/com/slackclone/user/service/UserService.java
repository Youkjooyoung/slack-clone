package com.slackclone.user.service;

import com.slackclone.common.util.SecurityUtil;
import com.slackclone.domain.user.entity.User;
import com.slackclone.user.dto.UpdateProfileRequest;
import com.slackclone.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final SecurityUtil securityUtil;

    @Transactional(readOnly = true)
    public UserResponse getMe() {
        return UserResponse.from(securityUtil.getCurrentUser());
    }

    @Transactional
    public UserResponse updateProfile(UpdateProfileRequest request) {
        User user = securityUtil.getCurrentUser();
        user.updateProfile(
                request.displayName(),
                request.avatarUrl(),
                request.statusMessage(),
                request.statusEmoji()
        );
        return UserResponse.from(user);
    }
}
