'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Client, type IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { usePresenceStore } from '@/store/presenceStore'
import type { ChatMessage } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8080'

interface UseWebSocketOptions {
  workspaceId: string
  channelId: string
}

export function useWebSocket({ workspaceId, channelId }: UseWebSocketOptions) {
  const clientRef = useRef<Client | null>(null)
  const { accessToken } = useAuthStore()
  const { addMessage, updateMessage, removeMessage, incrementReplyCount } = useChatStore()
  const { setUserOnline } = usePresenceStore()

  const sendMessage = useCallback(
    (content: string, parentId?: string) => {
      if (!clientRef.current?.connected) return
      clientRef.current.publish({
        destination: `/app/channel/${workspaceId}/${channelId}/send`,
        body: JSON.stringify({ content, parentId: parentId ?? null }),
      })
    },
    [workspaceId, channelId]
  )

  useEffect(() => {
    if (!accessToken) return

    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`${WS_URL}/ws?token=${accessToken}`),
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/channel/${channelId}`, (msg: IMessage) => {
          const body = JSON.parse(msg.body) as ChatMessage

          if (!body.parentId) {
            addMessage(channelId, body)
          } else {
            incrementReplyCount(channelId, body.parentId)
          }

          window.dispatchEvent(new CustomEvent('ws:channel-message', { detail: body }))
        })

        client.subscribe(
          `/topic/channel/${channelId}/update`,
          (msg: IMessage) => {
            const body = JSON.parse(msg.body) as ChatMessage
            updateMessage(channelId, body)
          }
        )

        client.subscribe(
          `/topic/channel/${channelId}/delete`,
          (msg: IMessage) => {
            removeMessage(channelId, msg.body)
          }
        )

        client.subscribe(
          `/topic/workspace/${workspaceId}/presence`,
          (msg: IMessage) => {
            const { userId, online } = JSON.parse(msg.body) as { userId: string; online: boolean }
            setUserOnline(workspaceId, userId, online)
          }
        )
      },
      onStompError: () => {},
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
    }
  }, [accessToken, channelId, workspaceId, addMessage, updateMessage, removeMessage, incrementReplyCount, setUserOnline])

  return { sendMessage, isConnected: !!clientRef.current?.connected }
}
