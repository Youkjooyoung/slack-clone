import { create } from 'zustand'
import type { ChatMessage } from '@/types'

interface ChatState {
  messages: Record<string, ChatMessage[]>  // channelId → messages (newest first)
  addMessage: (channelId: string, message: ChatMessage) => void
  setMessages: (channelId: string, messages: ChatMessage[]) => void
  prependMessages: (channelId: string, messages: ChatMessage[]) => void
  updateMessage: (channelId: string, updated: ChatMessage) => void
  removeMessage: (channelId: string, messageId: string) => void
  clearChannel: (channelId: string) => void
  incrementReplyCount: (channelId: string, parentId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},

  addMessage: (channelId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: [message, ...(state.messages[channelId] ?? [])],
      },
    })),

  setMessages: (channelId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [channelId]: messages },
    })),

  prependMessages: (channelId, older) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: [...(state.messages[channelId] ?? []), ...older],
      },
    })),

  updateMessage: (channelId, updated) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] ?? []).map((m) =>
          m.id === updated.id ? updated : m
        ),
      },
    })),

  removeMessage: (channelId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] ?? []).filter(
          (m) => m.id !== messageId
        ),
      },
    })),

  clearChannel: (channelId) =>
    set((state) => {
      const next = { ...state.messages }
      delete next[channelId]
      return { messages: next }
    }),

  incrementReplyCount: (channelId, parentId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] ?? []).map((m) =>
          m.id === parentId
            ? { ...m, replyCount: (m.replyCount ?? 0) + 1 }
            : m
        ),
      },
    })),
}))
