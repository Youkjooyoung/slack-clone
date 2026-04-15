package com.slackclone.file.controller;

import com.slackclone.common.response.ApiResponse;
import com.slackclone.common.util.SecurityUtil;
import com.slackclone.domain.user.entity.User;
import com.slackclone.file.dto.FileListResponse;
import com.slackclone.file.dto.FileUploadRequest;
import com.slackclone.file.dto.FileUploadResponse;
import com.slackclone.file.service.FileUploadService;
import com.slackclone.file.service.LocalFileUploadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileUploadService fileUploadService;
    private final LocalFileUploadService localFileUploadService;
    private final SecurityUtil securityUtil;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<FileUploadResponse>> requestUpload(
            @Valid @RequestBody FileUploadRequest request
    ) {
        User uploader = securityUtil.getCurrentUser();
        FileUploadResponse response = fileUploadService.generatePresignedUrl(request, uploader);
        return ResponseEntity.ok(ApiResponse.success("Presigned URL이 생성되었습니다.", response));
    }

    @PostMapping(value = "/upload/local", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<FileUploadResponse>> uploadLocal(
            @RequestParam("file") MultipartFile file
    ) {
        User uploader = securityUtil.getCurrentUser();
        FileUploadResponse response = localFileUploadService.uploadLocal(file, uploader);
        return ResponseEntity.ok(ApiResponse.success("파일이 업로드되었습니다.", response));
    }

    @GetMapping("/serve/{userId}/{fileName}")
    public ResponseEntity<Resource> serveFile(
            @PathVariable String userId,
            @PathVariable String fileName
    ) {
        return localFileUploadService.serveLocalFile(userId, fileName);
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<FileListResponse>>> getMyFiles() {
        User uploader = securityUtil.getCurrentUser();
        List<FileListResponse> files = fileUploadService.getMyFiles(uploader);
        return ResponseEntity.ok(ApiResponse.success("파일 목록을 조회했습니다.", files));
    }
}
