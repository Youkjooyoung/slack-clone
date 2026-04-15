import { create } from 'zustand'

interface PresenceState {
  onlineIds: Record<string, Set<string>>
  setOnlineIds: (workspaceId: string, ids: string[]) => void
  setUserOnline: (workspaceId: string, userId: string, online: boolean) => void
  getOnlineSet: (workspaceId: string) => Set<string>
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineIds: {},

  setOnlineIds: (workspaceId, ids) =>
    set((s) => ({
      onlineIds: { ...s.onlineIds, [workspaceId]: new Set(ids) },
    })),

  setUserOnline: (workspaceId, userId, online) =>
    set((s) => {
      const prev = new Set(s.onlineIds[workspaceId] ?? [])
      if (online) prev.add(userId)
      else prev.delete(userId)
      return { onlineIds: { ...s.onlineIds, [workspaceId]: prev } }
    }),

  getOnlineSet: (workspaceId) => get().onlineIds[workspaceId] ?? new Set(),
}))
