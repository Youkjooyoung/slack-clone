'use client'

import { useRef, useEffect, useCallback, useState, KeyboardEvent, ChangeEvent } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { dmApi } from '@/lib/api'
import { useDmWebSocket } from '@/hooks/useDmWebSocket'
import type { DmMessage, DmPage, UserProfile } from '@/types'
import styles from '@/components/chat/chat.module.css'

interface DmAreaProps {
  workspaceId: string
  targetUser: UserProfile
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

const GROUP_THRESHOLD_MS = 5 * 60 * 1000

const IMAGE_URL_RE = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(\?[^\s]*)?/gi

function extractImageUrls(content: string): string[] {
  return [...content.matchAll(IMAGE_URL_RE)].map((m) => m[0])
}

function isGrouped(msg: DmMessage, prev: DmMessage | undefined): boolean {
  if (!prev) return false
  if (msg.senderId !== prev.senderId) return false
  // column-reverse: msg(index i) 는 prev(index i+1) 보다 최신
  return new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_THRESHOLD_MS
}

export function DmArea({ workspaceId, targetUser }: DmAreaProps) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [localMessages, setLocalMessages] = useState<DmMessage[]>([])

  const conversationKey = ['dm', workspaceId, targetUser.id]

  const checkAtBottom = useCallback(() => {
    const el = messageListRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollTop >= -40
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = messageListRef.current
    if (el) el.scrollTop = 0
  }, [])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: conversationKey,
      queryFn: ({ pageParam }) =>
        dmApi
          .getMessages(workspaceId, targetUser.id, pageParam as string | undefined)
          .then((r) => r.data.data),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage: DmPage) =>
        lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
    })

  useEffect(() => {
    if (!data) return
    const all = data.pages.flatMap((p) => p.messages)
    setLocalMessages(all)
    scrollToBottom()
  }, [data, scrollToBottom])

  const handleNewMessage = useCallback((msg: DmMessage) => {
    setLocalMessages((prev) => [msg, ...prev])
    if (isAtBottomRef.current) scrollToBottom()
  }, [scrollToBottom])

  const handleUpdate = useCallback((msg: DmMessage) => {
    setLocalMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
  }, [])

  const handleDelete = useCallback((dmId: string) => {
    setLocalMessages((prev) => prev.filter((m) => m.id !== dmId))
  }, [])

  const { sendMessage } = useDmWebSocket({
    workspaceId,
    targetUserId: targetUser.id,
    currentUserId: user?.id ?? '',
    onMessage: handleNewMessage,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  })

  const handleSend = useCallback(() => {
    const text = textareaRef.current?.value.trim()
    if (!text) return
    sendMessage(text)
    if (textareaRef.current) textareaRef.current.value = ''
  }, [sendMessage])

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

  function renderMessages() {
    const result: JSX.Element[] = []
    for (let i = 0; i < localMessages.length; i++) {
      const msg = localMessages[i]
      const prev = localMessages[i + 1]
      const grouped = isGrouped(msg, prev)
      const showDate = !prev || !isSameDay(msg.createdAt, prev.createdAt)

      const rowClass = [
        styles.messageRow,
        grouped ? styles.messageRowGrouped : styles.messageRowFirst,
      ].join(' ')

      result.push(
        <div key={msg.id} className={rowClass}>
          {grouped ? (
            <div className={styles.groupedTime}>{formatTime(msg.createdAt)}</div>
          ) : (
            <div className={styles.avatarWrap}>
              {msg.senderAvatarUrl ? (
                <img src={msg.senderAvatarUrl} alt={msg.senderUsername} className={styles.avatarImg} />
              ) : (
                <div className={styles.avatarFallback}>
                  {(msg.senderDisplayName ?? msg.senderUsername).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}
          <div className={styles.messageBody}>
            {!grouped && (
              <div className={styles.messageMeta}>
                <span className={styles.senderName}>
                  {msg.senderDisplayName ?? msg.senderUsername}
                </span>
                <span className={styles.messageTime}>{formatTime(msg.createdAt)}</span>
                {msg.isEdited && <span className={styles.editedBadge}>(수정됨)</span>}
              </div>
            )}
            <p className={styles.messageContent}>{msg.content}</p>
            {extractImageUrls(msg.content).map((url, i) => (
              <img
                key={i}
                src={url}
                alt="첨부 이미지"
                className={styles.inlineImage}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ))}
          </div>
          {msg.senderId === user?.id && (
            <div className={styles.messageActions}>
              <button className={styles.actionBtn} title="삭제"
                onClick={() => {
                  dmApi.deleteMessage(msg.id).then(() => handleDelete(msg.id))
                }}>🗑</button>
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

  const displayName = targetUser.displayName ?? targetUser.username

  return (
    <div className={styles.chatArea}>
      <div className={styles.header}>
        <div className={styles.avatarFallback} style={{ width: 24, height: 24, fontSize: '0.75rem', borderRadius: '50%' }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className={styles.headerName}>{displayName}</span>
      </div>

      <div
        ref={messageListRef}
        className={styles.messageList}
        onScroll={checkAtBottom}
      >
        {renderMessages()}

        {hasNextPage && (
          <button className={styles.loadMoreBtn} onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? '불러오는 중...' : '이전 메시지 더 보기'}
          </button>
        )}

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>메시지를 불러오는 중...</div>
        )}

        {!isLoading && localMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#616061' }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {displayName}과의 대화
            </p>
            <p style={{ fontSize: '0.9375rem' }}>첫 메시지를 보내보세요.</p>
          </div>
        )}
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputBox}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={`${displayName}에게 메시지 보내기`}
            rows={1}
            onKeyDown={handleKeyDown}
            onChange={handleAutoResize}
          />
          <div className={styles.inputFooter}>
            <button className={styles.sendBtn} onClick={handleSend} title="전송 (Enter)">▶</button>
          </div>
        </div>
      </div>
    </div>
  )
}
