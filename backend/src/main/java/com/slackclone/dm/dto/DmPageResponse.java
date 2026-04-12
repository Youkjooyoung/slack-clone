package com.slackclone.dm.dto;

import java.util.List;

public record DmPageResponse(
        List<DmResponse> messages,
        boolean hasMore,
        String nextCursor
) {}
