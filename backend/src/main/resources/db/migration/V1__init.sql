-- =====================================================================
-- Slack Clone - PostgreSQL Schema
-- V1__init.sql (Flyway migration)
-- =====================================================================

-- =====================================================================
-- USERS
-- =====================================================================
CREATE TABLE USERS (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    username        VARCHAR(100)    NOT NULL,
    display_name    VARCHAR(100),
    avatar_url      VARCHAR(500),
    status_message  VARCHAR(200),
    status_emoji    VARCHAR(50),
    is_online       BOOLEAN         NOT NULL DEFAULT FALSE,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_users_email
    ON USERS (email)
    WHERE deleted_at IS NULL;

-- =====================================================================
-- WORKSPACES
-- =====================================================================
CREATE TABLE WORKSPACES (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)    NOT NULL,
    slug            VARCHAR(100)    NOT NULL,
    description     TEXT,
    icon_url        VARCHAR(500),
    owner_id        UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT fk_workspaces_owner
        FOREIGN KEY (owner_id) REFERENCES USERS (id)
);

CREATE UNIQUE INDEX uq_workspaces_slug
    ON WORKSPACES (slug)
    WHERE deleted_at IS NULL;

-- =====================================================================
-- WORKSPACE_MEMBERS
-- =====================================================================
CREATE TABLE WORKSPACE_MEMBERS (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID            NOT NULL,
    user_id         UUID            NOT NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'MEMBER',
    joined_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT fk_workspace_members_workspace
        FOREIGN KEY (workspace_id) REFERENCES WORKSPACES (id),
    CONSTRAINT fk_workspace_members_user
        FOREIGN KEY (user_id) REFERENCES USERS (id)
);

CREATE UNIQUE INDEX uq_workspace_members_active
    ON WORKSPACE_MEMBERS (workspace_id, user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_workspace_members_workspace_id ON WORKSPACE_MEMBERS (workspace_id);
CREATE INDEX idx_workspace_members_user_id      ON WORKSPACE_MEMBERS (user_id);

-- =====================================================================
-- CHANNELS
-- =====================================================================
CREATE TABLE CHANNELS (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID            NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    description     TEXT,
    is_private      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_archived     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT fk_channels_workspace
        FOREIGN KEY (workspace_id) REFERENCES WORKSPACES (id),
    CONSTRAINT fk_channels_created_by
        FOREIGN KEY (created_by) REFERENCES USERS (id)
);

CREATE INDEX idx_channels_workspace_id ON CHANNELS (workspace_id);

-- =====================================================================
-- CHANNEL_MEMBERS
-- =====================================================================
CREATE TABLE CHANNEL_MEMBERS (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID            NOT NULL,
    user_id         UUID            NOT NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'MEMBER',
    last_read_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT fk_channel_members_channel
        FOREIGN KEY (channel_id) REFERENCES CHANNELS (id),
    CONSTRAINT fk_channel_members_user
        FOREIGN KEY (user_id) REFERENCES USERS (id)
);

CREATE UNIQUE INDEX uq_channel_members_active
    ON CHANNEL_MEMBERS (channel_id, user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_channel_members_channel_id ON CHANNEL_MEMBERS (channel_id);
CREATE INDEX idx_channel_members_user_id    ON CHANNEL_MEMBERS (user_id);

-- =====================================================================
-- MESSAGES
-- =====================================================================
CREATE TABLE MESSAGES (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID            NOT NULL,
    sender_id       UUID            NOT NULL,
    parent_id       UUID,                          -- NULL = 일반 메시지, non-NULL = 스레드 답글
    content         TEXT,
    is_edited       BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT fk_messages_channel
        FOREIGN KEY (channel_id) REFERENCES CHANNELS (id),
    CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_id) REFERENCES USERS (id),
    CONSTRAINT fk_messages_parent
        FOREIGN KEY (parent_id) REFERENCES MESSAGES (id)
);

CREATE INDEX idx_messages_channel_id ON MESSAGES (channel_id);
CREATE INDEX idx_messages_sender_id  ON MESSAGES (sender_id);
CREATE INDEX idx_messages_parent_id  ON MESSAGES (parent_id);

-- =====================================================================
-- DIRECT_MESSAGES
-- =====================================================================
CREATE TABLE DIRECT_MESSAGES (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID            NOT NULL,
    sender_id       UUID            NOT NULL,
    receiver_id     UUID            NOT NULL,
    content         TEXT,
    is_edited       BOOLEAN         NOT NULL DEFAULT FALSE,
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT fk_direct_messages_workspace
        FOREIGN KEY (workspace_id) REFERENCES WORKSPACES (id),
    CONSTRAINT fk_direct_messages_sender
        FOREIGN KEY (sender_id) REFERENCES USERS (id),
    CONSTRAINT fk_direct_messages_receiver
        FOREIGN KEY (receiver_id) REFERENCES USERS (id)
);

CREATE INDEX idx_direct_messages_workspace_id  ON DIRECT_MESSAGES (workspace_id);
CREATE INDEX idx_direct_messages_sender_id     ON DIRECT_MESSAGES (sender_id);
CREATE INDEX idx_direct_messages_receiver_id   ON DIRECT_MESSAGES (receiver_id);

-- =====================================================================
-- ATTACHMENTS
-- =====================================================================
CREATE TABLE ATTACHMENTS (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id          UUID,
    direct_message_id   UUID,
    uploader_id         UUID            NOT NULL,
    file_name           VARCHAR(255)    NOT NULL,
    file_url            VARCHAR(500)    NOT NULL,
    file_size           BIGINT,
    mime_type           VARCHAR(100),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT chk_attachments_target CHECK (
        (message_id IS NOT NULL AND direct_message_id IS NULL) OR
        (message_id IS NULL     AND direct_message_id IS NOT NULL)
    ),
    CONSTRAINT fk_attachments_message
        FOREIGN KEY (message_id)        REFERENCES MESSAGES        (id),
    CONSTRAINT fk_attachments_direct_message
        FOREIGN KEY (direct_message_id) REFERENCES DIRECT_MESSAGES (id),
    CONSTRAINT fk_attachments_uploader
        FOREIGN KEY (uploader_id)       REFERENCES USERS           (id)
);

CREATE INDEX idx_attachments_message_id        ON ATTACHMENTS (message_id);
CREATE INDEX idx_attachments_direct_message_id ON ATTACHMENTS (direct_message_id);

-- =====================================================================
-- REACTIONS
-- =====================================================================
CREATE TABLE REACTIONS (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id          UUID,
    direct_message_id   UUID,
    user_id             UUID            NOT NULL,
    emoji               VARCHAR(50)     NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT chk_reactions_target CHECK (
        (message_id IS NOT NULL AND direct_message_id IS NULL) OR
        (message_id IS NULL     AND direct_message_id IS NOT NULL)
    ),
    CONSTRAINT fk_reactions_message
        FOREIGN KEY (message_id)        REFERENCES MESSAGES        (id),
    CONSTRAINT fk_reactions_direct_message
        FOREIGN KEY (direct_message_id) REFERENCES DIRECT_MESSAGES (id),
    CONSTRAINT fk_reactions_user
        FOREIGN KEY (user_id)           REFERENCES USERS           (id)
);

-- 동일 메시지/DM에 동일 유저가 같은 이모지를 중복 등록 방지 (soft delete 고려)
CREATE UNIQUE INDEX uq_reactions_message_active
    ON REACTIONS (message_id, user_id, emoji)
    WHERE message_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_reactions_dm_active
    ON REACTIONS (direct_message_id, user_id, emoji)
    WHERE direct_message_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_reactions_message_id        ON REACTIONS (message_id);
CREATE INDEX idx_reactions_direct_message_id ON REACTIONS (direct_message_id);

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================
CREATE TABLE NOTIFICATIONS (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL,
    type            VARCHAR(50)     NOT NULL,       -- MENTION, CHANNEL_MESSAGE, DIRECT_MESSAGE, REACTION, SYSTEM
    title           VARCHAR(255),
    content         TEXT,
    reference_id    UUID,                           -- 연관 리소스 ID (polymorphic)
    reference_type  VARCHAR(50),                    -- MESSAGE, DIRECT_MESSAGE, CHANNEL
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES USERS (id)
);

CREATE INDEX idx_notifications_user_id     ON NOTIFICATIONS (user_id);
CREATE INDEX idx_notifications_user_unread ON NOTIFICATIONS (user_id, is_read) WHERE is_read = FALSE;
