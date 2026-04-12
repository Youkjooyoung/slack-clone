package com.slackclone.presence.service;

import com.slackclone.domain.user.repository.UserRepository;
import com.slackclone.domain.workspace.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PresenceService {

    private static final String ONLINE_KEY = "user:online:";
    private static final long TTL_SECONDS = 120;

    private final RedisTemplate<String, Object> redisTemplate;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    @Transactional
    public void setOnline(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            redisTemplate.opsForValue().set(
                    ONLINE_KEY + user.getId(), "1", TTL_SECONDS, TimeUnit.SECONDS);
            user.updateOnlineStatus(true, null);
        });
    }

    @Transactional
    public void setOffline(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            redisTemplate.delete(ONLINE_KEY + user.getId());
            user.updateOnlineStatus(false, OffsetDateTime.now());
        });
    }

    public Set<String> getOnlineUserIds(UUID workspaceId) {
        return workspaceMemberRepository.findUserIdsByWorkspaceId(workspaceId)
                .stream()
                .filter(uid -> Boolean.TRUE.equals(
                        redisTemplate.hasKey(ONLINE_KEY + uid)))
                .map(UUID::toString)
                .collect(Collectors.toSet());
    }
}
