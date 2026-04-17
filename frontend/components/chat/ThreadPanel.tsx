'use client'

import { useRef, useCallback, useState, useEffect, KeyboardEvent, ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { messageApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { ChatMessage, Channel } from '@/types'
import { toast } from 'sonner'
import styles from './chat.module.css'
import threadStyles from './thread.module.css'
import { useMention, MentionDropdown } from '@/hooks/useMention'
import { renderMarkdown } from '@/lib/markdown'

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

const IMAGE_URL_RE = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(\?[^\s]*)?/gi

function extractImageUrls(content: string): string[] {
  return [...content.matchAll(IMAGE_URL_RE)].map((m) => m[0])
}

export function ThreadPanel({ workspaceId, channel, parentMessage, onClose, sendMessage }: ThreadPanelProps) {
  const { user } = useAuthStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  const [localReplies, setLocalReplies] = useState<ChatMessage[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const { data: fetchedReplies = [], isLoading } = useQuery({
    queryKey: ['replies', parentMessage.id],
    queryFn: () => messageApi.getReplies(parentMessage.id).then((r) => r.data.data),
    staleTime: 30_000,
  })

  const {
    mentionQuery, mentionIndex, setMentionIndex, filteredMembers,
    handleMentionChange, handleMentionKeyDown, insertMention
  } = useMention(workspaceId, textareaRef)

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (msg.parentId === parentMessage.id) {
      setLocalReplies((prev) => {
        if (prev.find((r) => r.id === msg.id)) return prev
        return [...prev, msg]
      })
      queryClient.setQueryData<ChatMessage[]>(['replies', parentMessage.id], (old = []) => {
        if (old.find((r) => r.id === msg.id)) return old
        return [...old, msg]
      })
    }
  }, [parentMessage.id, queryClient])

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      await messageApi.deleteMessage(messageId)
      setLocalReplies((prev) => prev.filter((m) => m.id !== messageId))
      toast.success('답글이 삭제되었습니다.')
    } catch {
      toast.error('답글 삭제에 실패했습니다.')
    }
  }, [])

  const handleEditStart = useCallback((msg: ChatMessage) => {
    setEditingId(msg.id)
    setEditContent(msg.content)
    setTimeout(() => editTextareaRef.current?.focus(), 0)
  }, [])

  const handleEditSubmit = useCallback(async (messageId: string) => {
    const content = editContent.trim()
    if (!content) return
    try {
      const res = await messageApi.editMessage(messageId, content)
      setLocalReplies((prev) => prev.map((m) => (m.id === messageId ? res.data.data : m)))
      toast.success('답글이 수정되었습니다.')
    } catch {
      toast.error('답글 수정에 실패했습니다.')
    }
    setEditingId(null)
    setEditContent('')
  }, [editContent])

  const handleEditKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>, messageId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit(messageId)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
      setEditContent('')
    }
  }, [handleEditSubmit])

  const handleSend = useCallback(() => {
    const text = textareaRef.current?.value.trim()
    if (!text) return
    sendMessage(text, parentMessage.id)
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
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

  useEffect(() => {
    setLocalReplies(fetchedReplies)
  }, [fetchedReplies])

  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<ChatMessage>).detail
      handleNewMessage(msg)
    }
    window.addEventListener('ws:channel-message', handler)
    return () => window.removeEventListener('ws:channel-message', handler)
  }, [handleNewMessage])

  return (
    <div className={threadStyles.panel}>
      <div className={threadStyles.header}>
        <span className={threadStyles.title}>스레드</span>
        <button className={threadStyles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={threadStyles.originalMsg}>
        <div className={`${styles.messageRow} ${threadStyles.originalMsgRow}`}>
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
            <p className={styles.messageContent} dangerouslySetInnerHTML={{ __html: renderMarkdown(parentMessage.content) }} />
            {extractImageUrls(parentMessage.content).map((url, i) => (
              <img
                key={i}
                src={url}
                alt="첨부 이미지"
                className={styles.inlineImage}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={threadStyles.divider}>
        <div className={threadStyles.dividerLine} />
        <span>{localReplies.length}개 답글</span>
        <div className={threadStyles.dividerLine} />
      </div>

      <div className={threadStyles.replyList}>
        {isLoading && <div className={threadStyles.loadingMsg}>불러오는 중...</div>}
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
                {reply.isEdited && <span className={styles.editedBadge}>(수정됨)</span>}
              </div>

              {editingId === reply.id ? (
                <div className={styles.editBox}>
                  <textarea
                    ref={editTextareaRef}
                    className={styles.editTextarea}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, reply.id)}
                    rows={2}
                  />
                  <div className={styles.editActions}>
                    <span className={styles.editHint}>Enter 저장 · Esc 취소</span>
                    <button className={styles.editSaveBtn} onClick={() => handleEditSubmit(reply.id)}>저장</button>
                    <button className={styles.editCancelBtn} onClick={() => { setEditingId(null); setEditContent('') }}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={styles.messageContent} dangerouslySetInnerHTML={{ __html: renderMarkdown(reply.content) }} />
                  {extractImageUrls(reply.content).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt="첨부 이미지"
                      className={styles.inlineImage}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ))}
                </>
              )}
            </div>
            {reply.senderId === user?.id && editingId !== reply.id && (
              <div className={styles.messageActions}>
                <button className={styles.actionBtn} title="수정" onClick={() => handleEditStart(reply)}>✏️</button>
                <button className={styles.actionBtn} title="삭제" onClick={() => handleDelete(reply.id)}>🗑</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={threadStyles.inputWrap}>
        <div className={styles.inputBox}>
          <MentionDropdown
            mentionQuery={mentionQuery} mentionIndex={mentionIndex} setMentionIndex={setMentionIndex}
            filteredMembers={filteredMembers} insertMention={insertMention}
          />
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="답글 보내기..."
            rows={1}
            onKeyDown={(e) => handleMentionKeyDown(e, handleKeyDown)}
            onChange={(e) => { handleAutoResize(e); handleMentionChange(e); }}
          />
          <div className={styles.inputFooter}>
            <button className={styles.sendBtn} onClick={handleSend} title="전송 (Enter)">▶</button>
          </div>
        </div>
      </div>
    </div>
  )
}
