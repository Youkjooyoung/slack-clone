-- 파일 독립 업로드(presigned 방식) 지원을 위해
-- message_id, direct_message_id 동시 NOT NULL만 금지 (각각 NULL 허용)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attachments'
      AND constraint_name = 'chk_attachments_target'
  ) THEN
    ALTER TABLE attachments DROP CONSTRAINT chk_attachments_target;
  END IF;
END $$;

ALTER TABLE attachments ADD CONSTRAINT chk_attachments_target CHECK (
    NOT (message_id IS NOT NULL AND direct_message_id IS NOT NULL)
);
