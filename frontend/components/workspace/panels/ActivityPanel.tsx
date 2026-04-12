'use client'

import type { AppNotification } from '@/types'
import styles from './panel.module.css'

interface ActivityPanelProps {
  notifications: AppNotification[]
  onNotifRead: (id: string) => void
  onReadAll: () => void
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return '오늘'
  if (d.toDateString() === yesterday.toDateString()) return '어제'
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'MENTION': return '💬'
    case 'DM': return '✉️'
    case 'CHANNEL_INVITE': return '📢'
    case 'REACTION': return '❤️'
    default: return '🔔'
  }
}

export function ActivityPanel({ notifications, onNotifRead, onReadAll }: ActivityPanelProps) {
  // Group by date
  const grouped = notifications.reduce<Record<string, AppNotification[]>>((acc, n) => {
    const label = formatDateLabel(n.createdAt)
    if (!acc[label]) acc[label] = []
    acc[label].push(n)
    return acc
  }, {})

  const dateKeys = Object.keys(grouped)

  return (
    <div className={styles.panel}>
      <div className={styles.panelScroll}>
        {notifications.length > 0 && (
          <button className={styles.activityReadAll} onClick={onReadAll}>
            모두 읽음으로 표시
          </button>
        )}

        {dateKeys.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🔔</span>
            새 활동이 없습니다
          </div>
        )}

        {dateKeys.map((dateLabel) => (
          <div key={dateLabel}>
            <div className={styles.activityDateLabel}>{dateLabel}</div>
            {grouped[dateLabel].map((n) => (
              <div
                key={n.id}
                className={`${styles.activityItem} ${n.isRead ? styles.activityItemRead : ''}`}
                onClick={() => onNotifRead(n.id)}
              >
                <div className={styles.activityItemHeader}>
                  <span className={styles.activityItemType}>{getTypeIcon(n.type)}</span>
                  <span className={styles.activityItemTitle}>{n.title}</span>
                  <span className={styles.activityItemTime}>{formatTime(n.createdAt)}</span>
                </div>
                <p className={styles.activityItemContent}>{n.content}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
