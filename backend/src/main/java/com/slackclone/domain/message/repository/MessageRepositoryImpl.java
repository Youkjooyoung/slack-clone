package com.slackclone.domain.message.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import com.slackclone.domain.message.entity.Message;
import com.slackclone.domain.message.entity.QMessage;
import com.slackclone.domain.user.entity.QUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class MessageRepositoryImpl implements MessageRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<Message> findByChannelIdBeforeCursor(UUID channelId, OffsetDateTime cursor, int size) {
        QMessage message = QMessage.message;
        QUser sender = QUser.user;

        var query = queryFactory
                .selectFrom(message)
                .join(message.sender, sender).fetchJoin()
                .where(
                        message.channel.id.eq(channelId),
                        message.parent.isNull(),
                        message.deletedAt.isNull()
                );

        if (cursor != null) {
            query = query.where(message.createdAt.lt(cursor));
        }

        return query
                .orderBy(message.createdAt.desc())
                .limit(size)
                .fetch();
    }
}
