package com.slackclone.og.controller;

import com.slackclone.common.response.ApiResponse;
import com.slackclone.og.dto.OgMetaResponse;
import com.slackclone.og.service.OgService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/og")
@RequiredArgsConstructor
public class OgController {

    private final OgService ogService;

    /**
     * GET /api/og?url=https://...
     * 외부 URL의 OG 메타태그를 파싱해 반환합니다 (CORS 프록시 역할).
     */
    @GetMapping
    public ResponseEntity<?> getOgMeta(@RequestParam String url) {

        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("유효하지 않은 URL입니다."));
        }

        OgMetaResponse meta = ogService.fetchOgMeta(url);
        if (meta == null) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.ok(ApiResponse.success(meta));
    }
}
