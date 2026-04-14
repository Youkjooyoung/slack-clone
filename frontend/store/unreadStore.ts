import { create } from 'zustand'

interface UnreadState {
  channelUnread: Record<string, number>  // channelId → unread count
  dmUnread: Record<string, number>       // fromUserId → unread count

  setChannelCounts: (counts: Record<string, number>) => void
  incrementChannel: (channelId: string) => void
  clearChannel: (channelId: string) => void

  incrementDm: (fromUserId: string) => void
  clearDm: (fromUserId: string) => void

  totalDmUnread: () => number
}

export const useUnreadStore = create<UnreadState>((set, get) => ({
  channelUnread: {},
  dmUnread: {},

  setChannelCounts: (counts) =>
    set({ channelUnread: counts }),

  incrementChannel: (channelId) =>
    set((s) => ({
      channelUnread: {
        ...s.channelUnread,
        [channelId]: (s.channelUnread[channelId] ?? 0) + 1,
      },
    })),

  clearChannel: (channelId) =>
    set((s) => {
      const next = { ...s.channelUnread }
      delete next[channelId]
      return { channelUnread: next }
    }),

  incrementDm: (fromUserId) =>
    set((s) => ({
      dmUnread: {
        ...s.dmUnread,
        [fromUserId]: (s.dmUnread[fromUserId] ?? 0) + 1,
      },
    })),

  clearDm: (fromUserId) =>
    set((s) => {
      const next = { ...s.dmUnread }
      delete next[fromUserId]
      return { dmUnread: next }
    }),

  totalDmUnread: () => {
    const { dmUnread } = get()
    return Object.values(dmUnread).reduce((a, b) => a + b, 0)
  },
}))
