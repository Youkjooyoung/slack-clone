'use client'

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  KeyboardEvent,
  ChangeEvent,
  MouseEvent,
  useMemo,
} from 'react'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { messageApi, reactionApi } from '@/lib/api'
import { useLayoutStore } from '@/store/layoutStore'
import type { Channel, ChatMessage, MessagePage, Reaction } from '@/types'
import { FileUploadDropzone } from './FileUploadDropzone'
import type { UploadedFile } from '@/hooks/useFileUpload'
import { useMention, MentionDropdown } from '@/hooks/useMention'
import { ThreadPanel } from './ThreadPanel'
import { toast } from 'sonner'
import styles from './chat.module.css'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮']
const EMOJI_PALETTE = ['😀','😂','🥲','😍','🤩','😎','🤔','😢','😡','🥳','👍','👎','👏','🙌','❤️','🔥','⭐','💯','✅','🎉','🚀','💬','📌','📎']
const GROUP_THRESHOLD_MS = 5 * 60 * 1000 // 5분 이내 연속 메시지 → 그룹

interface ChatAreaProps {
  workspaceId: string
  channel: Channel
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

const IMAGE_URL_RE = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(\?[^\s]*)?/gi

function extractImageUrls(content: string): string[] {
  return [...content.matchAll(IMAGE_URL_RE)].map((m) => m[0])
}

/** 간단한 마크다운 → HTML 변환 (bold, italic, code, strikethrough) */
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

/** 이전 메시지와 같은 sender + 5분 이내 → grouped */
function isGrouped(msg: ChatMessage, prev: ChatMessage | undefined): boolean {
  if (!prev) return false
  if (msg.senderId !== prev.senderId) return false
  // column-reverse: msg(index i) 는 prev(index i+1) 보다 최신
  return new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_THRESHOLD_MS
}

export function ChatArea({ workspaceId, channel }: ChatAreaProps) {
  const { user } = useAuthStore()
  const { messages, setMessages, removeMessage, updateMessage } = useChatStore()
  const { inputMinHeight, setInputMinHeight } = useLayoutStore()
  const [inputHeight, setInputHeight] = useState(inputMinHeight)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)
  const isDragging = useRef(false)

  // Sync from store when it changes (e.g. MorePanel preset change)
  useEffect(() => { setInputHeight(inputMinHeight) }, [inputMinHeight])

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiPickerOpen) return
    function handleClickOutside(e: globalThis.MouseEvent) {
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

  const handleResizeStart = useCallback((e: MouseEvent<HTMLDivElement>) => {
    isDragging.current = true
    dragStartY.current = e.clientY
    dragStartH.current = inputHeight
    e.preventDefault()

    const onMouseMove = (ev: globalThis.MouseEvent) => {
      if (!isDragging.current) return
      const delta = dragStartY.current - ev.clientY // drag up = positive = taller
      const next = Math.max(44, Math.min(300, dragStartH.current + delta))
      setInputHeight(next)
    }

    const onMouseUp = (ev: globalThis.MouseEvent) => {
      isDragging.current = false
      const delta = dragStartY.current - ev.clientY
      const persisted = Math.max(44, Math.min(300, dragStartH.current + delta))
      setInputMinHeight(persisted)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [inputHeight, setInputMinHeight])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([])
  const [threadMessage, setThreadMessage] = useState<ChatMessage | null>(null)
  const [messageReactions, setMessageReactions] = useState<Record<string, Reaction[]>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { mutate: toggleReaction } = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const existing = (messageReactions[messageId] ?? []).find(
        (r) => r.userId === user?.id && r.emoji === emoji
      )
      if (existing) {
        await reactionApi.removeFromMessage(messageId, emoji)
        return { messageId, emoji, removed: true, reaction: undefined }
      }
      const res = await reactionApi.addToMessage(messageId, emoji)
      return { messageId, emoji, removed: false, reaction: res.data.data }
    },
    onSuccess: ({ messageId, emoji, removed, reaction }) => {
      setMessageReactions((prev) => {
        const current = prev[messageId] ?? []
        if (removed) {
          return { ...prev, [messageId]: current.filter((r) => !(r.userId === user?.id && r.emoji === emoji)) }
        }
        return { ...prev, [messageId]: [...current, reaction!] }
      })
    },
    onError: () => toast.error('반응 처리에 실패했습니다.'),
  })

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      await messageApi.deleteMessage(messageId)
      removeMessage(channel.id, messageId)
      toast.success('메시지가 삭제되었습니다.')
    } catch {
      toast.error('메시지 삭제에 실패했습니다.')
    }
  }, [channel.id, removeMessage])

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
      updateMessage(channel.id, res.data.data)
      toast.success('메시지가 수정되었습니다.')
    } catch {
      toast.error('메시지 수정에 실패했습니다.')
    }
    setEditingId(null)
    setEditContent('')
  }, [editContent, channel.id, updateMessage])

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

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['search', channel.id, searchQuery],
    queryFn: () => searchQuery
      ? messageApi.search(workspaceId, channel.id, searchQuery).then((r) => r.data.data)
      : Promise.resolve([]),
    enabled: !!searchQuery,
    staleTime: 30_000,
  })

  const handleSearchOpen = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }, [])

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    setSearchInput('')
    setSearchQuery('')
  }, [])

  const handleSearchKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setSearchQuery(searchInput.trim())
    if (e.key === 'Escape') handleSearchClose()
  }, [searchInput, handleSearchClose])

  const { sendMessage } = useWebSocket({ workspaceId, channelId: channel.id })

  const {
    mentionQuery, mentionIndex, setMentionIndex, filteredMembers,
    handleMentionChange, handleMentionKeyDown, insertMention
  } = useMention(workspaceId, textareaRef)

  // ── 스크롤 자동 하단 이동 ──────────────────────────────────────────────────
  const messageListRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  // column-reverse라서 scrollTop 0 = 최신 메시지 위치
  const checkAtBottom = useCallback(() => {
    const el = messageListRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollTop >= -40 // 40px 이내면 "하단"
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = messageListRef.current
    if (el) el.scrollTop = 0
  }, [])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['messages', channel.id],
      queryFn: ({ pageParam }) =>
        messageApi
          .getMessages(workspaceId, channel.id, pageParam as string | undefined)
          .then((r) => r.data.data),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage: MessagePage) =>
        lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
    })

  useEffect(() => {
    if (!data) return
    setMessages(channel.id, data.pages.flatMap((p) => p.messages))
    // 첫 로드 시 하단으로 스크롤
    scrollToBottom()
  }, [data, channel.id, setMessages, scrollToBottom])

  // 새 메시지 도착 시 하단에 있으면 자동 스크롤
  const channelMessages = messages[channel.id] ?? []
  const latestMsgId = channelMessages[0]?.id
  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom()
  }, [latestMsgId, scrollToBottom])

  useEffect(() => {
    messageApi.markAsRead(workspaceId, channel.id).catch(() => null)
  }, [workspaceId, channel.id])

  const handleSend = useCallback(() => {
    const text = textareaRef.current?.value.trim() ?? ''
    if (!text && attachedFiles.length === 0) return

    // 첨부 파일 URL을 메시지에 포함
    const fileLinks = attachedFiles
      .map((f) => f.attachment.fileUrl)
      .filter(Boolean)
      .join('\n')

    const fullContent = [text, fileLinks].filter(Boolean).join('\n')
    if (fullContent) sendMessage(fullContent)

    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
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

  const handleFilesChange = useCallback((files: UploadedFile[]) => {
    setAttachedFiles(files)
  }, [])

  const renderedMessages = useMemo(() => {
    const result: JSX.Element[] = []

    for (let i = 0; i < channelMessages.length; i++) {
      const msg = channelMessages[i]
      // messageList가 column-reverse이므로 배열 다음 항목이 시간상 이전 메시지
      const prevMsg = channelMessages[i + 1]
      const grouped = isGrouped(msg, prevMsg)
      const showDate = !prevMsg || !isSameDay(msg.createdAt, prevMsg.createdAt)

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
          {/* 아바타 or 시간 */}
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
            {/* 이름 + 시간 (첫 메시지만) */}
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

            {/* 이모지 반응 */}
            {Object.keys(reactionGroups).length > 0 && (
              <div className={styles.reactionBar}>
                {Object.entries(reactionGroups).map(([emoji, { count, mine }]) => (
                  <button
                    key={emoji}
                    className={`${styles.reactionChip} ${mine ? styles.reactionMine : ''}`}
                    onClick={() => toggleReaction({ messageId: msg.id, emoji })}
                  >
                    {emoji} {count}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 호버 액션 */}
          <div className={styles.messageActions}>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className={styles.actionBtn}
                title={emoji}
                onClick={() => toggleReaction({ messageId: msg.id, emoji })}
              >
                {emoji}
              </button>
            ))}
            <button
              className={styles.actionBtn}
              title="스레드에서 답글"
              onClick={() => setThreadMessage(msg)}
            >
              💬
            </button>
            {msg.senderId === user?.id && (
              <>
                <button
                  className={styles.actionBtn}
                  title="수정"
                  onClick={() => handleEditStart(msg)}
                >
                  ✏️
                </button>
                <button
                  className={styles.actionBtn}
                  title="삭제"
                  onClick={() => handleDelete(msg.id)}
                >
                  🗑
                </button>
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
  }, [channelMessages, messageReactions, user?.id, editingId, editContent, handleEditStart, handleEditSubmit, handleEditKeyDown, handleDelete, toggleReaction])

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      <div className={styles.chatArea}>
        {/* 채널 헤더 */}
        <div className={styles.header}>
          {searchOpen ? (
            <>
              <input
                ref={searchInputRef}
                className={styles.searchInput}
                placeholder="메시지 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <button className={styles.headerActionBtn} onClick={handleSearchClose} title="닫기">✕</button>
            </>
          ) : (
            <>
              <span className={styles.headerHash}>#</span>
              <span className={styles.headerName}>{channel.name}</span>
              {channel.description && (
                <>
                  <div className={styles.headerSep} />
                  <span className={styles.headerDesc}>{channel.description}</span>
                </>
              )}
              <div style={{ flex: 1 }} />
              <button className={styles.headerActionBtn} onClick={handleSearchOpen} title="검색">🔍</button>
            </>
          )}
        </div>

        {/* 검색 결과 패널 */}
        {searchQuery && (
          <div className={styles.searchPanel}>
            <div className={styles.searchPanelHeader}>
              "{searchQuery}" 검색 결과 {isSearching ? '...' : `(${searchResults.length}건)`}
            </div>
            {!isSearching && searchResults.length === 0 && (
              <div className={styles.searchEmpty}>결과가 없습니다.</div>
            )}
            {searchResults.map((msg) => (
              <div key={msg.id} className={styles.searchResultItem}>
                <span className={styles.searchSender}>{msg.senderDisplayName ?? msg.senderUsername}</span>
                <span className={styles.searchTime}>{formatTime(msg.createdAt)}</span>
                <p className={styles.searchContent}>{msg.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* 메시지 목록 */}
        <div
          ref={messageListRef}
          className={styles.messageList}
          onScroll={checkAtBottom}
        >
        {renderedMessages}

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
            <div style={{ textAlign: 'center', padding: '2rem', color: '#bbb', fontSize: '0.875rem' }}>
              메시지를 불러오는 중...
            </div>
          )}

          {!isLoading && channelMessages.length === 0 && (
            <div className={styles.emptyChannel}>
              <div className={styles.emptyChannelIcon}>#</div>
              <p className={styles.emptyChannelTitle}># {channel.name} 채널에 오신 것을 환영합니다!</p>
              <p className={styles.emptyChannelDesc}>
                {channel.description ?? `이 채널의 첫 번째 메시지를 보내보세요.`}
              </p>
            </div>
          )}
        </div>

        {/* 입력창 */}
        <div className={styles.inputArea}>
          {/* Drag-to-resize handle */}
          <div className={styles.resizeHandle} onMouseDown={handleResizeStart} title="드래그해서 크기 조절" />
          <FileUploadDropzone onFilesChange={handleFilesChange}>
            <div className={styles.inputBox} style={{ position: 'relative' }}>
              <MentionDropdown
                mentionQuery={mentionQuery} mentionIndex={mentionIndex} setMentionIndex={setMentionIndex}
                filteredMembers={filteredMembers} insertMention={insertMention}
              />
              <div className={styles.inputToolbar}>
                <button className={styles.toolbarBtn} title="파일 첨부"
                  onClick={() => document.getElementById('file-upload-input')?.click()}>
                  📎
                </button>
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
                placeholder={`#${channel.name}에 메시지 보내기`}
                rows={1}
                style={{ minHeight: inputHeight }}
                onKeyDown={(e) => handleMentionKeyDown(e, handleKeyDown)}
                onChange={(e) => { handleAutoResize(e); handleMentionChange(e); }}
              />
              <div className={styles.inputFooter}>
                <span className={styles.inputHint}>Enter로 전송 · Shift+Enter로 줄바꿈</span>
                <button className={styles.sendBtn} onClick={handleSend} title="전송 (Enter)">
                  ➤
                </button>
              </div>
            </div>
          </FileUploadDropzone>
        </div>
      </div>

      {threadMessage && (
        <ThreadPanel
          workspaceId={workspaceId}
          channel={channel}
          parentMessage={threadMessage}
          onClose={() => setThreadMessage(null)}
          sendMessage={sendMessage}
        />
      )}
    </div>
  )
}
