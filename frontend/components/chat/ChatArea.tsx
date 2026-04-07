'use client'

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  KeyboardEvent,
  ChangeEvent,
} from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { messageApi } from '@/lib/api'
import type { Channel, ChatMessage, MessagePage } from '@/types'
import { FileUploadDropzone } from './FileUploadDropzone'
import type { UploadedFile } from '@/hooks/useFileUpload'
import styles from './chat.module.css'

interface ChatAreaProps {
  workspaceId: string
  channel: Channel
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export function ChatArea({ workspaceId, channel }: ChatAreaProps) {
  const { user } = useAuthStore()
  const { messages, setMessages, prependMessages } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([])
  const { sendMessage } = useWebSocket({
    workspaceId,
    channelId: channel.id,
  })

  // ── 무한 스크롤 (REST, 오래된 메시지 로드) ─────────────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['messages', channel.id],
    queryFn: ({ pageParam }) =>
      messageApi
        .getMessages(workspaceId, channel.id, pageParam as string | undefined)
        .then((r) => r.data.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: MessagePage) =>
      lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
  })

  // 첫 페이지 데이터 → chatStore 초기화
  useEffect(() => {
    if (!data) return
    const allMessages = data.pages.flatMap((p) => p.messages)
    setMessages(channel.id, allMessages)
  }, [data, channel.id, setMessages])

  // 읽음 처리
  useEffect(() => {
    messageApi.markAsRead(workspaceId, channel.id).catch(() => null)
  }, [workspaceId, channel.id])

  // 전송
  const handleSend = useCallback(() => {
    const text = textareaRef.current?.value.trim()
    if (!text && attachedFiles.length === 0) return
    sendMessage(text ?? '')
    if (textareaRef.current) textareaRef.current.value = ''
    setAttachedFiles([])
  }, [sendMessage, attachedFiles])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleAutoResize = (e: ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }

  const handleFileClick = () => {
    document.getElementById('file-upload-input')?.click()
  }

  const handleFilesChange = useCallback((files: UploadedFile[]) => {
    setAttachedFiles(files)
  }, [])

  const channelMessages: ChatMessage[] = messages[channel.id] ?? []

  // 날짜 구분선용 렌더
  function renderMessages() {
    const result: JSX.Element[] = []
    for (let i = 0; i < channelMessages.length; i++) {
      const msg = channelMessages[i]
      const prev = channelMessages[i + 1]
      const showDate = !prev || !isSameDay(msg.createdAt, prev.createdAt)

      result.push(
        <div key={msg.id} className={styles.messageRow}>
          <div className={styles.avatarWrap}>
            {msg.senderAvatarUrl ? (
              <img
                src={msg.senderAvatarUrl}
                alt={msg.senderUsername}
                className={styles.avatarImg}
              />
            ) : (
              <div className={styles.avatarFallback}>
                {(msg.senderDisplayName ?? msg.senderUsername)
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
          </div>
          <div className={styles.messageBody}>
            <div className={styles.messageMeta}>
              <span className={styles.senderName}>
                {msg.senderDisplayName ?? msg.senderUsername}
              </span>
              <span className={styles.messageTime}>
                {formatTime(msg.createdAt)}
              </span>
              {msg.isEdited && (
                <span className={styles.editedBadge}>(수정됨)</span>
              )}
            </div>
            <p className={styles.messageContent}>{msg.content}</p>
          </div>
          {msg.senderId === user?.id && (
            <div className={styles.messageActions}>
              <button className={styles.actionBtn} title="수정">✏</button>
              <button className={styles.actionBtn} title="삭제">🗑</button>
            </div>
          )}
        </div>
      )

      if (showDate) {
        result.push(
          <div key={`date-${msg.id}`} className={styles.dateDivider}>
            <div className={styles.dateLine} />
            <span>{formatDate(msg.createdAt)}</span>
            <div className={styles.dateLine} />
          </div>
        )
      }
    }
    return result
  }

  return (
    <div className={styles.chatArea}>
      {/* 채널 헤더 */}
      <div className={styles.header}>
        <span className={styles.headerHash}>#</span>
        <span className={styles.headerName}>{channel.name}</span>
        <span className={styles.readBadge}>
          {channelMessages.length > 0
            ? `메시지 ${channelMessages.length}개`
            : ''}
        </span>
      </div>

      {/* 메시지 목록 (최신이 아래) */}
      <div className={styles.messageList}>
        {renderMessages()}

        {hasNextPage && (
          <button
            className={styles.loadMoreBtn}
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? '불러오는 중...' : '이전 메시지 더 보기'}
          </button>
        )}

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
            메시지를 불러오는 중...
          </div>
        )}

        {!isLoading && channelMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#616061' }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              # {channel.name} 채널에 오신 것을 환영합니다!
            </p>
            <p style={{ fontSize: '0.9375rem' }}>
              {channel.description ?? '첫 메시지를 보내보세요.'}
            </p>
          </div>
        )}
      </div>

      {/* 입력창 */}
      <div className={styles.inputArea}>
        <FileUploadDropzone onFilesChange={handleFilesChange}>
          <div className={styles.inputBox}>
            <div className={styles.inputToolbar}>
              <button
                className={styles.toolbarBtn}
                onClick={handleFileClick}
                title="파일 첨부"
              >
                📎
              </button>
              <button className={styles.toolbarBtn} title="이모지">😊</button>
            </div>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder={`#${channel.name}에 메시지 보내기`}
              rows={1}
              onKeyDown={handleKeyDown}
              onChange={handleAutoResize}
            />
            <div className={styles.inputFooter}>
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                title="전송 (Enter)"
              >
                ▶
              </button>
            </div>
          </div>
        </FileUploadDropzone>
      </div>
    </div>
  )
}
