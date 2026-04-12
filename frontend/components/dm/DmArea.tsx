'use client'

import { useRef, useEffect, useCallback, useState, KeyboardEvent, ChangeEvent, useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { dmApi, reactionApi } from '@/lib/api'
import { useDmWebSocket } from '@/hooks/useDmWebSocket'
import type { DmMessage, DmPage, UserProfile, Reaction } from '@/types'
import { toast } from 'sonner'
import styles from '@/components/chat/chat.module.css'
import { useMention, MentionDropdown } from '@/hooks/useMention'

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

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮']
const EMOJI_PALETTE = ['😀','😂','🥲','😍','🤩','😎','🤔','😢','😡','🥳','👍','👎','👏','🙌','❤️','🔥','⭐','💯','✅','🎉','🚀','💬','📌','📎']

const GROUP_THRESHOLD_MS = 5 * 60 * 1000

const IMAGE_URL_RE = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(\?[^\s]*)?/gi

function extractImageUrls(content: string): string[] {
  return [...content.matchAll(IMAGE_URL_RE)].map((m) => m[0])
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
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
  const [messageReactions, setMessageReactions] = useState<Record<string, Reaction[]>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiPickerOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [emojiPickerOpen])

  const insertEmoji = useCallback((emoji: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, value } = ta
    ta.value = value.slice(0, s) + emoji + value.slice(s)
    ta.focus()
    ta.setSelectionRange(s + emoji.length, s + emoji.length)
    setEmojiPickerOpen(false)
  }, [])

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

  const { mutate: toggleReaction } = useMutation({
    mutationFn: async ({ dmId, emoji }: { dmId: string; emoji: string }) => {
      const existing = (messageReactions[dmId] ?? []).find(
        (r) => r.userId === user?.id && r.emoji === emoji
      )
      if (existing) {
        await reactionApi.removeFromDm(dmId, emoji)
        return { dmId, emoji, removed: true, reaction: undefined }
      }
      const res = await reactionApi.addToDm(dmId, emoji)
      return { dmId, emoji, removed: false, reaction: res.data.data }
    },
    onSuccess: ({ dmId, emoji, removed, reaction }) => {
      setMessageReactions((prev) => {
        const current = prev[dmId] ?? []
        if (removed) {
          return { ...prev, [dmId]: current.filter((r) => !(r.userId === user?.id && r.emoji === emoji)) }
        }
        return { ...prev, [dmId]: [...current, reaction!] }
      })
    },
    onError: () => toast.error('반응 처리에 실패했습니다.'),
  })

  const handleReactionAdd = useCallback((reaction: Reaction) => {
    if (!reaction.directMessageId) return
    setMessageReactions((prev) => {
      const current = prev[reaction.directMessageId!] ?? []
      if (current.find((r) => r.id === reaction.id)) return prev
      return { ...prev, [reaction.directMessageId!]: [...current, reaction] }
    })
  }, [])

  const handleReactionRemove = useCallback((reaction: Reaction) => {
    if (!reaction.directMessageId) return
    setMessageReactions((prev) => {
      const current = prev[reaction.directMessageId!] ?? []
      return { ...prev, [reaction.directMessageId!]: current.filter((r) => r.id !== reaction.id) }
    })
  }, [])

  const { sendMessage } = useDmWebSocket({
    workspaceId,
    targetUserId: targetUser.id,
    currentUserId: user?.id ?? '',
    onMessage: handleNewMessage,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
    onReactionAdd: handleReactionAdd,
    onReactionRemove: handleReactionRemove,
  })

  const {
    mentionQuery, mentionIndex, setMentionIndex, filteredMembers,
    handleMentionChange, handleMentionKeyDown, insertMention
  } = useMention(workspaceId, textareaRef)

  const handleEditStart = useCallback((msg: DmMessage) => {
    setEditingId(msg.id)
    setEditContent(msg.content)
    setTimeout(() => editTextareaRef.current?.focus(), 0)
  }, [])

  const handleEditSubmit = useCallback(async (dmId: string) => {
    const content = editContent.trim()
    if (!content) return
    try {
      const res = await dmApi.editMessage(dmId, content)
      handleUpdate(res.data.data)
      toast.success('메시지가 수정되었습니다.')
    } catch {
      toast.error('메시지 수정에 실패했습니다.')
    }
    setEditingId(null)
    setEditContent('')
  }, [editContent, handleUpdate])

  const handleEditKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>, dmId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit(dmId)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
      setEditContent('')
    }
  }, [handleEditSubmit])

  const handleSend = useCallback(() => {
    const text = textareaRef.current?.value.trim()
    if (!text) return
    sendMessage(text)
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto' // 전송 후 높이 초기화
    }
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

  const renderedMessages = useMemo(() => {
    const result: JSX.Element[] = []
    for (let i = 0; i < localMessages.length; i++) {
      const msg = localMessages[i]
      const prev = localMessages[i + 1]
      const grouped = isGrouped(msg, prev)
      const showDate = !prev || !isSameDay(msg.createdAt, prev.createdAt)

      const reactions = messageReactions[msg.id] ?? []
      const reactionGroups: Record<string, { count: number; mine: boolean }> = {}
      for (const r of reactions) {
        if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, mine: false }
        reactionGroups[r.emoji].count++
        if (r.userId === user?.id) reactionGroups[r.emoji].mine = true
      }

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
            {editingId === msg.id ? (
              <div className={styles.editBox}>
                <textarea
                  ref={editTextareaRef}
                  className={styles.editTextarea}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, msg.id)}
                  rows={2}
                />
                <div className={styles.editActions}>
                  <span className={styles.editHint}>Enter 저장 · Esc 취소</span>
                  <button className={styles.editSaveBtn} onClick={() => handleEditSubmit(msg.id)}>저장</button>
                  <button className={styles.editCancelBtn} onClick={() => { setEditingId(null); setEditContent('') }}>취소</button>
                </div>
              </div>
            ) : (
              <>
                <p className={styles.messageContent} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                {extractImageUrls(msg.content).map((url, i) => (
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

            {Object.keys(reactionGroups).length > 0 && (
              <div className={styles.reactionBar}>
                {Object.entries(reactionGroups).map(([emoji, { count, mine }]) => (
                  <button
                    key={emoji}
                    className={`${styles.reactionChip} ${mine ? styles.reactionMine : ''}`}
                    onClick={() => toggleReaction({ dmId: msg.id, emoji })}
                  >
                    {emoji} {count}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={styles.messageActions}>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className={styles.actionBtn}
                title={emoji}
                onClick={() => toggleReaction({ dmId: msg.id, emoji })}
              >
                {emoji}
              </button>
            ))}
            {msg.senderId === user?.id && (
              <>
                <button className={styles.actionBtn} title="수정"
                  onClick={() => handleEditStart(msg)}>
                  ✏️
                </button>
                <button className={styles.actionBtn} title="삭제"
                  onClick={() => {
                    dmApi.deleteMessage(msg.id).then(() => handleDelete(msg.id))
                  }}>🗑</button>
              </>
            )}
          </div>
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
  }, [localMessages, messageReactions, user?.id, editingId, editContent, handleEditStart, handleEditSubmit, handleEditKeyDown, handleDelete, toggleReaction])

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
        {renderedMessages}

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
        <div className={styles.inputBox} style={{ position: 'relative' }}>
          <MentionDropdown
            mentionQuery={mentionQuery} mentionIndex={mentionIndex} setMentionIndex={setMentionIndex}
            filteredMembers={filteredMembers} insertMention={insertMention}
          />
          <div className={styles.inputToolbar}>
            <button className={styles.toolbarBtn} title="굵게 (Ctrl+B)" style={{ fontWeight: 700, fontSize: '0.875rem' }}
              onClick={() => {
                const ta = textareaRef.current
                if (!ta) return
                const { selectionStart: s, selectionEnd: e, value } = ta
                const sel = value.slice(s, e)
                const newVal = value.slice(0, s) + `**${sel || '굵게'}**` + value.slice(e)
                ta.value = newVal
                ta.focus()
                ta.setSelectionRange(s + 2, s + 2 + (sel || '굵게').length)
              }}>B</button>
            <button className={styles.toolbarBtn} title="기울임 (Ctrl+I)" style={{ fontStyle: 'italic', fontSize: '0.875rem' }}
              onClick={() => {
                const ta = textareaRef.current
                if (!ta) return
                const { selectionStart: s, selectionEnd: e, value } = ta
                const sel = value.slice(s, e)
                const newVal = value.slice(0, s) + `_${sel || '기울임'}_` + value.slice(e)
                ta.value = newVal
                ta.focus()
                ta.setSelectionRange(s + 1, s + 1 + (sel || '기울임').length)
              }}>I</button>
            <div ref={emojiPickerRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button className={styles.toolbarBtn} title="이모지" onClick={() => setEmojiPickerOpen((o) => !o)}>😊</button>
              {emojiPickerOpen && (
                <div className={styles.emojiPicker}>
                  {EMOJI_PALETTE.map((emoji) => (
                    <button key={emoji} className={styles.emojiPickerItem} onClick={() => insertEmoji(emoji)}>{emoji}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={`${displayName}에게 메시지 보내기`}
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
