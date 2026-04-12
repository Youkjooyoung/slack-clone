'use client'

import type { Channel, WorkspaceMember, AppNotification } from '@/types'
import styles from './panel.module.css'

interface HomePanelProps {
  workspaceId: string
  channels: Channel[]
  unreadCounts: Record<string, number>
  members: WorkspaceMember[]
  onlineSet: Set<string>
  myMemberId: string | undefined
  notifications: AppNotification[]
  onChannelClick: (channel: Channel) => void
  onDmClick: (userId: string) => void
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function HomePanel({
  channels, unreadCounts, members, onlineSet,
  myMemberId, notifications, onChannelClick, onDmClick,
}: HomePanelProps) {
  // Sort channels: unread first, then alphabetical
  const sorted = [...channels].sort((a, b) => {
    const ua = unreadCounts[a.id] ?? 0
    const ub = unreadCounts[b.id] ?? 0
    if (ub !== ua) return ub - ua
    return a.name.localeCompare(b.name)
  })

  const others = members.filter((m) => m.userId !== myMemberId)
  const recentNotifs = notifications.filter((n) => !n.isRead).slice(0, 3)

  return (
    <div className={styles.panel}>
      <div className={styles.panelScroll}>

        {/* 알림 미리보기 */}
        {recentNotifs.length > 0 && (
          <>
            <div className={styles.sectionLabel}>새 알림</div>
            {recentNotifs.map((n) => (
              <div key={n.id} className={styles.activityItem}>
                <div className={styles.activityItemHeader}>
                  <span className={styles.activityItemType}>
                    {n.type === 'MENTION' ? '💬' : '🔔'}
                  </span>
                  <span className={styles.activityItemTitle}>{n.title}</span>
                  <span className={styles.activityItemTime}>{formatRelative(n.createdAt)}</span>
                </div>
                <p className={styles.activityItemContent}>{n.content}</p>
              </div>
            ))}
            <div className={styles.divider} />
          </>
        )}

        {/* 채널 목록 */}
        <div className={styles.sectionLabel}>채널</div>
        {sorted.map((ch) => {
          const unread = unreadCounts[ch.id] ?? 0
          return (
            <div key={ch.id} className={styles.item} onClick={() => onChannelClick(ch)}>
              <span className={styles.itemIcon}>#</span>
              <span className={styles.itemText}>{ch.name}</span>
              {unread > 0 && (
                <span className={styles.itemBadge}>{unread > 99 ? '99+' : unread}</span>
              )}
            </div>
          )
        })}

        {/* DM 목록 */}
        {others.length > 0 && (
          <>
            <div className={styles.divider} />
            <div className={styles.sectionLabel}>다이렉트 메시지</div>
            {others.map((m) => (
              <div key={m.userId} className={styles.item} onClick={() => onDmClick(m.userId)}>
                <span
                  className={styles.onlineDot}
                  style={{ backgroundColor: onlineSet.has(m.userId) ? '#2bac76' : '#97979b' }}
                />
                <span className={styles.itemText}>{m.displayName ?? m.username}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
