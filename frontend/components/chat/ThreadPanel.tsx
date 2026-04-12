'use client'

import { useRef, useCallback, useState, useEffect, KeyboardEvent, ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { messageApi } from '@/lib/api'
import type { ChatMessage, Channel } from '@/types'
import styles from './chat.module.css'
import threadStyles from './thread.module.css'

interface ThreadPanelProps {
  workspaceId: string
  channel: Channel
  parentMessage: ChatMessage
  onClose: () => void
  sendMessage: (content: string, parentId?: string) => void
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export function ThreadPanel({ workspaceId, channel, parentMessage, onClose, sendMessage }: ThreadPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()
  const [localReplies, setLocalReplies] = useState<ChatMessage[]>([])

  const { data: fetchedReplies = [], isLoading } = useQuery({
    queryKey: ['replies', parentMessage.id],
    queryFn: () => messageApi.getReplies(parentMessage.id).then((r) => r.data.data),
    staleTime: 30_000,
  })

  // REST로 불러온 답글을 초기값으로
  useEffect(() => {
    setLocalReplies(fetchedReplies)
  }, [fetchedReplies])

  // WebSocket으로 오는 새 메시지 중 parentId가 일치하면 즉시 추가
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (msg.parentId === parentMessage.id) {
      setLocalReplies((prev) => {
        if (prev.find((r) => r.id === msg.id)) return prev
        return [...prev, msg]
      })
      // React Query 캐시도 갱신
      queryClient.setQueryData<ChatMessage[]>(['replies', parentMessage.id], (old = []) => {
        if (old.find((r) => r.id === msg.id)) return old
        return [...old, msg]
      })
    }
  }, [parentMessage.id, queryClient])

  // ChatArea의 WebSocket에서 오는 메시지를 여기서도 구독
  // 같은 channelId → 같은 STOMP 연결이므로 별도 연결 없이 커스텀 이벤트로 처리
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<ChatMessage>).detail
      handleNewMessage(msg)
    }
    window.addEventListener('ws:channel-message', handler)
    return () => window.removeEventListener('ws:channel-message', handler)
  }, [handleNewMessage])

  const handleSend = useCallback(() => {
    const text = textareaRef.current?.value.trim()
    if (!text) return
    sendMessage(text, parentMessage.id)
    if (textareaRef.current) textareaRef.current.value = ''
  }, [sendMessage, parentMessage.id])

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

  return (
    <div className={threadStyles.panel}>
      <div className={threadStyles.header}>
        <span className={threadStyles.title}>스레드</span>
        <button className={threadStyles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* 원본 메시지 */}
      <div className={threadStyles.originalMsg}>
        <div className={styles.messageRow} style={{ padding: '0.5rem 0' }}>
          <div className={styles.avatarWrap}>
            {parentMessage.senderAvatarUrl ? (
              <img src={parentMessage.senderAvatarUrl} alt={parentMessage.senderUsername} className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarFallback}>
                {(parentMessage.senderDisplayName ?? parentMessage.senderUsername).charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className={styles.messageBody}>
            <div className={styles.messageMeta}>
              <span className={styles.senderName}>{parentMessage.senderDisplayName ?? parentMessage.senderUsername}</span>
              <span className={styles.messageTime}>{formatTime(parentMessage.createdAt)}</span>
            </div>
            <p className={styles.messageContent}>{parentMessage.content}</p>
          </div>
        </div>
      </div>

      <div className={threadStyles.divider}>
        <div className={threadStyles.dividerLine} />
        <span>{localReplies.length}개 답글</span>
        <div className={threadStyles.dividerLine} />
      </div>

      {/* 답글 목록 */}
      <div className={threadStyles.replyList}>
        {isLoading && <div style={{ padding: '1rem', color: '#999', textAlign: 'center' }}>불러오는 중...</div>}
        {localReplies.map((reply: ChatMessage) => (
          <div key={reply.id} className={`${styles.messageRow} ${styles.messageRowFirst}`}>
            <div className={styles.avatarWrap}>
              {reply.senderAvatarUrl ? (
                <img src={reply.senderAvatarUrl} alt={reply.senderUsername} className={styles.avatarImg} />
              ) : (
                <div className={styles.avatarFallback}>
                  {(reply.senderDisplayName ?? reply.senderUsername).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className={styles.messageBody}>
              <div className={styles.messageMeta}>
                <span className={styles.senderName}>{reply.senderDisplayName ?? reply.senderUsername}</span>
                <span className={styles.messageTime}>{formatTime(reply.createdAt)}</span>
              </div>
              <p className={styles.messageContent}>{reply.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 답글 입력 */}
      <div className={threadStyles.inputWrap}>
        <div className={styles.inputBox}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="답글 보내기..."
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
