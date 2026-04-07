package com.slackclone.message.dto;

import java.util.List;

public record MessagePageResponse(
        List<MessageResponse> messages,
        boolean hasMore,
        String nextCursor
) {}
