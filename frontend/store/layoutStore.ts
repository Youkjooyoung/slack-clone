import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeId = 'aubergine' | 'dark' | 'ocean' | 'forest'

export interface ThemeVars {
  name: string
  swatch: string
  iconRailBg: string
  sidebarBgTop: string
  sidebarBgBottom: string
  activeItemBg: string
}

export const THEMES: Record<ThemeId, ThemeVars> = {
  aubergine: {
    name: '남색',
    swatch: '#1e3a5f',
    iconRailBg: '#0f172a',
    sidebarBgTop: '#152238',
    sidebarBgBottom: '#0e1a2e',
    activeItemBg: '#1164a3',
  },
  dark: {
    name: '다크',
    swatch: '#1a1d21',
    iconRailBg: '#111315',
    sidebarBgTop: '#1a1d21',
    sidebarBgBottom: '#0f1013',
    activeItemBg: '#1164a3',
  },
  ocean: {
    name: '오션',
    swatch: '#0d2137',
    iconRailBg: '#0a1929',
    sidebarBgTop: '#0d2137',
    sidebarBgBottom: '#071526',
    activeItemBg: '#1264a3',
  },
  forest: {
    name: '포레스트',
    swatch: '#0a2818',
    iconRailBg: '#0a1a10',
    sidebarBgTop: '#0a2818',
    sidebarBgBottom: '#051510',
    activeItemBg: '#007a5a',
  },
}

interface LayoutState {
  theme: ThemeId
  inputMinHeight: number
  setTheme: (theme: ThemeId) => void
  setInputMinHeight: (h: number) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      theme: 'aubergine',
      inputMinHeight: 44,
      setTheme: (theme) => set({ theme }),
      setInputMinHeight: (inputMinHeight) => set({ inputMinHeight }),
    }),
    { name: 'slackclone-layout' }
  )
)
