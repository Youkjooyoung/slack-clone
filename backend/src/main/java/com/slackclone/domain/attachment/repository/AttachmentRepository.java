package com.slackclone.domain.attachment.repository;

import com.slackclone.domain.attachment.entity.Attachment;
import com.slackclone.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AttachmentRepository extends JpaRepository<Attachment, UUID> {
    List<Attachment> findByUploaderOrderByCreatedAtDesc(User uploader);
}
