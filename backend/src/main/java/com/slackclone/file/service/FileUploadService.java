package com.slackclone.file.service;

import com.slackclone.common.exception.BusinessException;
import com.slackclone.common.exception.ErrorCode;
import com.slackclone.domain.attachment.entity.Attachment;
import com.slackclone.domain.attachment.repository.AttachmentRepository;
import com.slackclone.domain.user.entity.User;
import com.slackclone.file.dto.FileListResponse;
import com.slackclone.file.dto.FileUploadRequest;
import com.slackclone.file.dto.FileUploadResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileUploadService {

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp"
    );
    private static final Set<String> ALLOWED_DOCUMENT_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    private static final long IMAGE_MAX_BYTES     = 5L  * 1024 * 1024;  // 5MB
    private static final long DOCUMENT_MAX_BYTES  = 20L * 1024 * 1024;  // 20MB

    @Autowired(required = false)
    private S3Presigner s3Presigner;
    private final AttachmentRepository attachmentRepository;

    @Value("${aws.s3.bucket-name:}")
    private String bucketName;

    @Value("${aws.s3.region:ap-northeast-2}")
    private String region;

    @Value("${aws.s3.presigned-url-expiry-minutes:15}")
    private int presignedUrlExpiryMinutes;

    @Transactional
    public FileUploadResponse generatePresignedUrl(FileUploadRequest request, User uploader) {
        validateFile(request.mimeType(), request.fileSize());

        String s3Key = buildS3Key(uploader.getId(), request.fileName());
        String fileUrl = buildFileUrl(s3Key);

        String presignedUrl = createPresignedUrl(s3Key, request.mimeType(), request.fileSize());

        Attachment attachment = Attachment.builder()
                .uploader(uploader)
                .fileName(request.fileName())
                .fileUrl(fileUrl)
                .fileSize(request.fileSize())
                .mimeType(request.mimeType())
                .s3Key(s3Key)
                .build();

        @SuppressWarnings("null")
        Attachment saved = attachmentRepository.save(attachment);

        return new FileUploadResponse(
                saved.getId(),
                presignedUrl,
                fileUrl,
                request.fileName(),
                request.mimeType(),
                request.fileSize()
        );
    }

    @Transactional(readOnly = true)
    public List<FileListResponse> getMyFiles(User uploader) {
        return attachmentRepository.findByUploaderOrderByCreatedAtDesc(uploader)
                .stream()
                .map(FileListResponse::from)
                .toList();
    }

    private void validateFile(String mimeType, long fileSize) {
        if (ALLOWED_IMAGE_TYPES.contains(mimeType)) {
            if (fileSize > IMAGE_MAX_BYTES) {
                throw new BusinessException(ErrorCode.FILE_SIZE_EXCEEDED);
            }
        } else if (ALLOWED_DOCUMENT_TYPES.contains(mimeType)) {
            if (fileSize > DOCUMENT_MAX_BYTES) {
                throw new BusinessException(ErrorCode.FILE_SIZE_EXCEEDED);
            }
        } else {
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED);
        }
    }

    private String buildS3Key(UUID uploaderId, String fileName) {
        String sanitized = fileName.replaceAll("[^a-zA-Z0-9.\\-_]", "_");
        return "uploads/" + uploaderId + "/" + UUID.randomUUID() + "-" + sanitized;
    }

    private String buildFileUrl(String s3Key) {
        return "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + s3Key;
    }

    private String createPresignedUrl(String s3Key, String mimeType, long fileSize) {
        if (s3Presigner == null || bucketName == null || bucketName.isBlank()) {
            throw new BusinessException(ErrorCode.S3_NOT_CONFIGURED);
        }

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Key)
                .contentType(mimeType)
                .contentLength(fileSize)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(presignedUrlExpiryMinutes))
                .putObjectRequest(putObjectRequest)
                .build();

        PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(presignRequest);
        return presigned.url().toString();
    }
}
