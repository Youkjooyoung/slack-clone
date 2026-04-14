'use client'

import { useEffect, useRef, useState } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { notificationApi } from '@/lib/api'
import styles from './notificationBell.module.css'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function handleRead(id: string) {
    markRead(id)
    await notificationApi.markAsRead(id).catch(() => null)
  }

  async function handleReadAll() {
    markAllRead()
    await notificationApi.markAllAsRead().catch(() => null)
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={() => setOpen((o) => !o)}
        title="알림"
        aria-label="알림"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>알림</span>
            <button className={styles.readAllBtn} onClick={handleReadAll}>모두 읽음</button>
          </div>
          {notifications.length === 0 ? (
            <div className={styles.empty}>새 알림이 없습니다.</div>
          ) : (
            <div className={styles.list}>
              {notifications.slice(0, 30).map((n) => (
                <div
                  key={n.id}
                  className={`${styles.item} ${n.isRead ? styles.itemRead : ''}`}
                  onClick={() => { handleRead(n.id); setOpen(false) }}
                >
                  <p className={styles.title}>{n.title}</p>
                  <p className={styles.content}>{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
