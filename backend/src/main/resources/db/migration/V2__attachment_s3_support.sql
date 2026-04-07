-- =====================================================================
-- V2: ATTACHMENTS 테이블 - S3 업로드 지원
-- 1. presigned URL 방식에서 업로드 직후 message_id 없는 pending 상태를 허용
-- 2. s3_key 컬럼 추가 (S3 객체 키)
-- =====================================================================

-- 기존 CHECK 제약 제거 (message_id/direct_message_id 모두 NULL 허용 → pending 상태)
ALTER TABLE ATTACHMENTS DROP CONSTRAINT IF EXISTS chk_attachments_target;

-- S3 객체 키 저장 컬럼 추가
ALTER TABLE ATTACHMENTS ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500);
