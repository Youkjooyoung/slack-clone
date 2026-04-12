import { create } from 'zustand'
import type { AppNotification } from '@/types'

interface NotificationStore {
  notifications: AppNotification[]
  unreadCount: number
  setNotifications: (ns: AppNotification[]) => void
  addNotification: (n: AppNotification) => void
  markRead: (id: string) => void
  markAllRead: () => void
  setUnreadCount: (n: number) => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (ns) =>
    set({ notifications: ns, unreadCount: ns.filter((n) => !n.isRead).length }),

  addNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications],
      unreadCount: s.unreadCount + (n.isRead ? 0 : 1),
    })),

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),

  setUnreadCount: (n) => set({ unreadCount: n }),
}))
