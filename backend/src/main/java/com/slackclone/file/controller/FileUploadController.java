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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileUploadController {

    private final FileUploadService fileUploadService;
    private final LocalFileUploadService localFileUploadService;
    private final SecurityUtil securityUtil;

    @Value("${local.upload.dir:uploads}")
    private String uploadDir;

    /** S3 presigned URL 방식 (S3 설정 시) */
    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<FileUploadResponse>> requestUpload(
            @Valid @RequestBody FileUploadRequest request
    ) {
        User uploader = securityUtil.getCurrentUser();
        FileUploadResponse response = fileUploadService.generatePresignedUrl(request, uploader);
        return ResponseEntity.ok(ApiResponse.success("Presigned URL이 생성되었습니다.", response));
    }

    /** 로컬 저장소 직접 업로드 (S3 미설정 시 폴백) */
    @PostMapping(value = "/upload/local", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<FileUploadResponse>> uploadLocal(
            @RequestParam("file") MultipartFile file
    ) {
        User uploader = securityUtil.getCurrentUser();
        FileUploadResponse response = localFileUploadService.uploadLocal(file, uploader);
        return ResponseEntity.ok(ApiResponse.success("파일이 업로드되었습니다.", response));
    }

    /** 로컬 저장 파일 서빙 */
    @GetMapping("/serve/{userId}/{fileName}")
    public ResponseEntity<Resource> serveFile(
            @PathVariable String userId,
            @PathVariable String fileName
    ) {
        try {
            Path filePath = Paths.get(uploadDir, userId, fileName);
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists()) return ResponseEntity.notFound().build();

            String contentType = fileName.matches(".*\\.(png|jpg|jpeg|gif|webp)$")
                    ? "image/" + fileName.replaceAll(".*\\.", "").replace("jpg", "jpeg")
                    : MediaType.APPLICATION_OCTET_STREAM_VALUE;

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<FileListResponse>>> getMyFiles() {
        User uploader = securityUtil.getCurrentUser();
        List<FileListResponse> files = fileUploadService.getMyFiles(uploader);
        return ResponseEntity.ok(ApiResponse.success("파일 목록을 조회했습니다.", files));
    }
}
