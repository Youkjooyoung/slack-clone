package com.slackclone.file.controller;

import com.slackclone.common.response.ApiResponse;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.domain.user.entity.User;
import com.slackclone.file.dto.FileUploadRequest;
import com.slackclone.file.dto.FileUploadResponse;
import com.slackclone.file.service.FileUploadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileUploadService fileUploadService;
    private final SecurityUtil securityUtil;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<FileUploadResponse>> requestUpload(
            @Valid @RequestBody FileUploadRequest request
    ) {
        User uploader = securityUtil.getCurrentUser();
        FileUploadResponse response = fileUploadService.generatePresignedUrl(request, uploader);
        return ResponseEntity.ok(ApiResponse.success("Presigned URL이 생성되었습니다.", response));
    }
}
