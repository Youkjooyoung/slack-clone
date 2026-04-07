package com.slackclone.domain.user.entity;

import com.slackclone.domain.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;

import java.time.OffsetDateTime;

@Entity
@Table(name = "USERS")
@SQLRestriction("deleted_at IS NULL")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class User extends BaseEntity {

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "username", nullable = false, length = 100)
    private String username;

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "status_message", length = 200)
    private String statusMessage;

    @Column(name = "status_emoji", length = 50)
    private String statusEmoji;

    @Builder.Default
    @Column(name = "is_online", nullable = false)
    private boolean online = false;

    @Column(name = "last_seen_at")
    private OffsetDateTime lastSeenAt;

    public void updateProfile(String displayName, String avatarUrl,
                              String statusMessage, String statusEmoji) {
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
        this.statusMessage = statusMessage;
        this.statusEmoji = statusEmoji;
    }

    public void updateOnlineStatus(boolean online, OffsetDateTime lastSeenAt) {
        this.online = online;
        this.lastSeenAt = lastSeenAt;
    }

    public void changePassword(String newPasswordHash) {
        this.passwordHash = newPasswordHash;
    }
}
