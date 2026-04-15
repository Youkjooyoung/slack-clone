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

    @GetMapping
    public ResponseEntity<?> getOgMeta(@RequestParam String url) {
        OgMetaResponse meta = ogService.fetchOgMeta(url);
        if (meta == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(ApiResponse.success(meta));
    }
}
