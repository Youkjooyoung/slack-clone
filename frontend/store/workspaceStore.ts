import { create } from 'zustand'
import type { Workspace, Channel } from '@/types'

interface WorkspaceState {
  currentWorkspace: Workspace | null
  currentChannel: Channel | null
  setCurrentWorkspace: (workspace: Workspace | null) => void
  setCurrentChannel: (channel: Channel | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentWorkspace: null,
  currentChannel: null,
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setCurrentChannel: (channel) => set({ currentChannel: channel }),
}))
