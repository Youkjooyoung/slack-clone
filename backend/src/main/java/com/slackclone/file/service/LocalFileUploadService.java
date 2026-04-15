package com.slackclone.file.service;

import com.slackclone.common.exception.BusinessException;
import com.slackclone.common.exception.ErrorCode;
import com.slackclone.domain.attachment.entity.Attachment;
import com.slackclone.domain.attachment.repository.AttachmentRepository;
import com.slackclone.domain.user.entity.User;
import com.slackclone.file.dto.FileUploadResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LocalFileUploadService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    private static final long IMAGE_MAX = 5L * 1024 * 1024;
    private static final long DOC_MAX   = 20L * 1024 * 1024;

    private final AttachmentRepository attachmentRepository;

    @Value("${local.upload.dir:uploads}")
    private String uploadDir;

    @Value("${local.upload.base-url:http://localhost:8080}")
    private String baseUrl;

    public ResponseEntity<Resource> serveLocalFile(String userId, String fileName) {
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

    @Transactional
    public FileUploadResponse uploadLocal(MultipartFile file, User uploader) {
        String mimeType = file.getContentType();
        long fileSize = file.getSize();

        if (mimeType == null || !ALLOWED_TYPES.contains(mimeType)) {
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED);
        }
        boolean isImage = mimeType.startsWith("image/");
        if (isImage && fileSize > IMAGE_MAX) throw new BusinessException(ErrorCode.FILE_SIZE_EXCEEDED);
        if (!isImage && fileSize > DOC_MAX)  throw new BusinessException(ErrorCode.FILE_SIZE_EXCEEDED);

        String rawName = file.getOriginalFilename();
        String originalName = (rawName != null && !rawName.isBlank()) ? rawName : "file";
        String sanitized = originalName.replaceAll("[^a-zA-Z0-9.\\-_]", "_");
        String storedName = UUID.randomUUID() + "-" + sanitized;
        String s3Key = "local/" + uploader.getId() + "/" + storedName;

        Path dir = Paths.get(uploadDir, uploader.getId().toString());
        try {
            Files.createDirectories(dir);
            Files.copy(file.getInputStream(), dir.resolve(storedName));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        String fileUrl = baseUrl + "/api/files/serve/" + uploader.getId() + "/" + storedName;

        Attachment attachment = Attachment.builder()
                .uploader(uploader)
                .fileName(originalName)
                .fileUrl(fileUrl)
                .fileSize(fileSize)
                .mimeType(mimeType)
                .s3Key(s3Key)
                .build();
        @SuppressWarnings("null")
        Attachment saved = attachmentRepository.save(attachment);

        return new FileUploadResponse(saved.getId(), fileUrl, fileUrl, originalName, mimeType, fileSize);
    }
}
