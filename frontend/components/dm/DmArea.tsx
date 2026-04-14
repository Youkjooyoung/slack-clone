'use client'

import { useRef, useEffect, useCallback, useState, KeyboardEvent, useMemo } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { dmApi, reactionApi, workspaceApi } from '@/lib/api'
import { useDmWebSocket } from '@/hooks/useDmWebSocket'
import type { DmMessage, DmPage, UserProfile, Reaction, WorkspaceMember } from '@/types'
import { toast } from 'sonner'
import styles from '@/components/chat/chat.module.css'
import { MentionDropdown } from '@/hooks/useMention'
import { FileUploadDropzone } from '@/components/chat/FileUploadDropzone'
import type { UploadedFile } from '@/hooks/useFileUpload'
import { usePresenceStore } from '@/store/presenceStore'
import { useUnreadStore } from '@/store/unreadStore'
import { LinkPreview, extractPreviewUrl } from '@/components/chat/LinkPreview'
import { NotificationBell } from '@/components/notifications/NotificationBell'

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

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div><br\s*\/?><\/div>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '_$1_')
    .replace(/<i>(.*?)<\/i>/gi, '_$1_')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/^\n+/, '')
}

function insertAtCursor(el: HTMLElement, text: string) {
  el.focus()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.setEndAfter(node)
  sel.removeAllRanges()
  sel.addRange(range)
}

const IMAGE_URL_RE = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(\?[^\s]*)?/gi
const FILE_SERVE_RE = /https?:\/\/\S+\/api\/files\/serve\/\S+/gi

function extractImageUrls(content: string): string[] {
  const fromExt = [...content.matchAll(IMAGE_URL_RE)].map((m) => m[0])
  const fromServe = [...content.matchAll(FILE_SERVE_RE)].map((m) => m[0])
  return [...new Set([...fromExt, ...fromServe])]
}

function stripImageUrls(content: string): string {
  const imageUrls = extractImageUrls(content)
  let result = content
  for (const url of imageUrls) {
    result = result.replace(url, '')
  }
  return result.trim()
}

function renderMarkdown(text: string): string {
  // URL을 플레이스홀더로 보호 (언더스코어 등이 마크다운으로 변환되지 않도록)
  const urls: string[] = []
  let processed = text.replace(/https?:\/\/\S+/g, (match) => {
    urls.push(match)
    return `__URL_PLACEHOLDER_${urls.length - 1}__`
  })

  processed = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(?<![a-zA-Z0-9\/_])_(.+?)_(?![a-zA-Z0-9\/_])/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')

  // URL 복원 (클릭 가능한 링크로 변환)
  processed = processed.replace(/__URL_PLACEHOLDER_(\d+)__/g, (_, idx) => {
    const url = urls[Number(idx)]
    const escaped = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer" style="color:#1264a3;text-decoration:none">${escaped}</a>`
  })

  return processed
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
  const isTargetOnline = usePresenceStore((s) => s.getOnlineSet(workspaceId).has(targetUser.id))
  const editorRef = useRef<HTMLDivElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [localMessages, setLocalMessages] = useState<DmMessage[]>([])
  const [messageReactions, setMessageReactions] = useState<Record<string, Reaction[]>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([])
  const attachedFilesRef = useRef<UploadedFile[]>([])
  const [dropzoneKey, setDropzoneKey] = useState(0)

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
    const el = editorRef.current
    if (!el) return
    insertAtCursor(el, emoji)
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

  // DM 창 열면 해당 유저의 unread 즉시 초기화
  useEffect(() => {
    useUnreadStore.getState().clearDm(targetUser.id)
  }, [targetUser.id])

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

  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)

  const { data: members = [] } = useQuery<WorkspaceMember[]>({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getMembers(workspaceId).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return []
    const lq = mentionQuery.toLowerCase()
    return members.filter((m) =>
      m.username.toLowerCase().includes(lq) || (m.displayName?.toLowerCase() ?? '').includes(lq)
    ).slice(0, 6)
  }, [members, mentionQuery])

  useEffect(() => { setMentionIndex(0) }, [filteredMembers.length])

  const detectMention = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const cloned = range.cloneRange()
    cloned.selectNodeContents(el)
    cloned.setEnd(range.startContainer, range.startOffset)
    const text = cloned.toString()
    const match = text.match(/(?:^|\s)@([a-zA-Z0-9가-힣_]*)$/)
    setMentionQuery(match ? match[1] : null)
  }, [])

  const insertMention = useCallback((member: WorkspaceMember) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const cloned = range.cloneRange()
    cloned.selectNodeContents(el)
    cloned.setEnd(range.startContainer, range.startOffset)
    const text = cloned.toString()
    const match = text.match(/(?:^|\s)@([a-zA-Z0-9가-힣_]*)$/)
    if (!match) return
    const mentionLen = match[1].length + 1
    const delRange = document.createRange()
    delRange.setStart(range.startContainer, Math.max(0, range.startOffset - mentionLen))
    delRange.setEnd(range.startContainer, range.startOffset)
    delRange.deleteContents()
    const node = document.createTextNode(`@${member.username} `)
    delRange.insertNode(node)
    delRange.setStartAfter(node)
    delRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(delRange)
    setMentionQuery(null)
  }, [])

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

  const handleFilesChange = useCallback((files: UploadedFile[]) => {
    attachedFilesRef.current = files
    setAttachedFiles(files)
  }, [])

  const handleSend = useCallback(() => {
    const el = editorRef.current
    const text = htmlToMarkdown(el?.innerHTML ?? '').trim()
    const files = attachedFilesRef.current
    if (!text && files.length === 0) return

    const fileLinks = files
      .map((f) => f.attachment.fileUrl)
      .filter(Boolean)
      .join('\n')

    const fullContent = [text, fileLinks].filter(Boolean).join('\n')
    if (fullContent) sendMessage(fullContent)

    if (el) el.innerHTML = ''
    setAttachedFiles([])
    attachedFilesRef.current = []
    setDropzoneKey((k) => k + 1)
    setMentionQuery(null)
  }, [sendMessage])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (mentionQuery !== null && filteredMembers.length > 0) {
        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((p) => (p > 0 ? p - 1 : filteredMembers.length - 1)); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((p) => (p < filteredMembers.length - 1 ? p + 1 : 0)); return }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[mentionIndex]); return }
        if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return }
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        handleSend()
      }
    },
    [mentionQuery, filteredMembers, mentionIndex, insertMention, handleSend]
  )

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
                {(() => {
                  const imageUrls = extractImageUrls(msg.content)
                  const textOnly = stripImageUrls(msg.content)
                  const previewUrl = extractPreviewUrl(msg.content)
                  return (
                    <>
                      {textOnly && (
                        <p className={styles.messageContent} dangerouslySetInnerHTML={{ __html: renderMarkdown(textOnly) }} />
                      )}
                      {imageUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="첨부 이미지"
                          className={styles.inlineImage}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ))}
                      {previewUrl && <LinkPreview url={previewUrl} />}
                    </>
                  )
                })()}
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
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div className={styles.avatarFallback} style={{ width: 28, height: 28, fontSize: '0.8rem', borderRadius: '50%' }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span
            className={isTargetOnline ? styles.presenceDotOnline : styles.presenceDotOffline}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span className={styles.headerName}>{displayName}</span>
          <span style={{ fontSize: '0.6875rem', color: isTargetOnline ? '#2bac76' : '#97979b' }}>
            {isTargetOnline ? '온라인' : '오프라인'}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div className={styles.headerActionGroup}>
          <button className={styles.headerActionBtn} title="검색" onClick={() => {}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <NotificationBell />
        </div>
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
        <FileUploadDropzone key={dropzoneKey} onFilesChange={handleFilesChange} inputId="dm-file-upload-input">
          <div className={styles.inputBox} style={{ position: 'relative' }}>
            <MentionDropdown
              mentionQuery={mentionQuery} mentionIndex={mentionIndex} setMentionIndex={setMentionIndex}
              filteredMembers={filteredMembers} insertMention={insertMention}
            />
            <div className={styles.inputToolbar}>
              <button className={styles.toolbarBtn} title="파일 첨부"
                onClick={() => document.getElementById('dm-file-upload-input')?.click()}>
                📎
              </button>
              <button className={styles.toolbarBtn} title="굵게 (Ctrl+B)" style={{ fontWeight: 700, fontSize: '0.875rem' }}
                onMouseDown={(e) => { e.preventDefault(); editorRef.current?.focus(); document.execCommand('bold') }}>B</button>
              <button className={styles.toolbarBtn} title="기울임 (Ctrl+I)" style={{ fontStyle: 'italic', fontSize: '0.875rem' }}
                onMouseDown={(e) => { e.preventDefault(); editorRef.current?.focus(); document.execCommand('italic') }}>I</button>
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
            <div
              ref={editorRef}
              className={styles.richInput}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={`${displayName}에게 메시지 보내기`}
              onKeyDown={handleKeyDown}
              onInput={detectMention}
            />
            <div className={styles.inputFooter}>
              <span className={styles.inputHint}>Enter로 전송 · Shift+Enter로 줄바꿈</span>
              <button className={styles.sendBtn} onClick={handleSend} title="전송 (Enter)">➤</button>
            </div>
          </div>
        </FileUploadDropzone>
      </div>
    </div>
  )
}
