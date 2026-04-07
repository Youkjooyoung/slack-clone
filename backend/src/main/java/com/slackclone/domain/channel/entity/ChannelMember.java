package com.slackclone.domain.channel.entity;

import com.slackclone.domain.common.entity.BaseEntity;
import com.slackclone.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;

import java.time.OffsetDateTime;

@Entity
@Table(name = "CHANNEL_MEMBERS")
@SQLRestriction("deleted_at IS NULL")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class ChannelMember extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "channel_id", nullable = false)
    private Channel channel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private ChannelRole role;

    @Column(name = "last_read_at")
    private OffsetDateTime lastReadAt;

    public void changeRole(ChannelRole role) {
        this.role = role;
    }

    public void markAsRead() {
        this.lastReadAt = OffsetDateTime.now();
    }
}
