'use client'

import { useState, useMemo, useCallback, useEffect, type RefObject, type ChangeEvent, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/lib/api'
import type { WorkspaceMember } from '@/types'
import styles from './mention.module.css'

export function useMention(workspaceId: string, textareaRef: RefObject<HTMLTextAreaElement>) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)

  const { data: members = [] } = useQuery<WorkspaceMember[]>({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getMembers(workspaceId).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return []
    const lowerQuery = mentionQuery.toLowerCase()
    return members.filter(m => {
      const name = m.username.toLowerCase()
      const disp = m.displayName?.toLowerCase() ?? ''
      return name.includes(lowerQuery) || disp.includes(lowerQuery)
    }).slice(0, 6)
  }, [members, mentionQuery])

  useEffect(() => {
    setMentionIndex(0)
  }, [filteredMembers.length])

  const handleMentionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursor = e.target.selectionStart
    const textBeforeCursor = val.slice(0, cursor)
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9가-힣_]*)$/)

    if (match) {
      setMentionQuery(match[1])
    } else {
      setMentionQuery(null)
    }
  }, [])

  const insertMention = useCallback((member: WorkspaceMember) => {
    const ta = textareaRef.current
    if (!ta) return
    const val = ta.value
    const cursor = ta.selectionStart
    const textBeforeCursor = val.slice(0, cursor)
    const textAfterCursor = val.slice(cursor)

    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9가-힣_]*)$/)
    if (!match) return

    const replaceStart = cursor - match[1].length - 1
    const newTextBefore = val.slice(0, replaceStart) + `@${member.username} `

    ta.value = newTextBefore + textAfterCursor
    const newCursorPos = newTextBefore.length
    ta.setSelectionRange(newCursorPos, newCursorPos)
    ta.focus()
    setMentionQuery(null)
  }, [textareaRef])

  const handleMentionKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>, fallback: (e: KeyboardEvent<HTMLTextAreaElement>) => void) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(prev => (prev > 0 ? prev - 1 : filteredMembers.length - 1))
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(prev => (prev < filteredMembers.length - 1 ? prev + 1 : 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredMembers[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }
    fallback(e)
  }, [mentionQuery, filteredMembers, mentionIndex, insertMention])

  return {
    mentionQuery,
    mentionIndex,
    setMentionIndex,
    filteredMembers,
    handleMentionChange,
    handleMentionKeyDown,
    insertMention
  }
}

export function MentionDropdown({
  mentionQuery, mentionIndex, setMentionIndex, filteredMembers, insertMention
}: {
  mentionQuery: string | null, mentionIndex: number, setMentionIndex: (i: number) => void,
  filteredMembers: WorkspaceMember[], insertMention: (m: WorkspaceMember) => void
}) {
  if (mentionQuery === null || filteredMembers.length === 0) return null

  return (
    <div className={styles.dropdown}>
      {filteredMembers.map((m, i) => {
        const isActive = i === mentionIndex
        return (
          <div
            key={m.userId}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
            onClick={() => insertMention(m)}
            onMouseEnter={() => setMentionIndex(i)}
          >
            <div className={`${styles.itemAvatar} ${isActive ? styles.itemAvatarActive : ''}`}>
              {m.displayName?.charAt(0).toUpperCase() ?? m.username.charAt(0).toUpperCase()}
            </div>
            <span className={`${styles.itemUsername} ${isActive ? styles.itemUsernameActive : ''}`}>
              {m.username}
            </span>
            {m.displayName && m.displayName !== m.username && (
              <span className={`${styles.itemDisplayName} ${isActive ? styles.itemDisplayNameActive : ''}`}>
                ({m.displayName})
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}