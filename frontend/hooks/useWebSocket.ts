'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Client, type IMessage, type IFrame } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import type { ChatMessage } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8080'

interface UseWebSocketOptions {
  workspaceId: string
  channelId: string
}

export function useWebSocket({ workspaceId, channelId }: UseWebSocketOptions) {
  const clientRef = useRef<Client | null>(null)
  const { accessToken } = useAuthStore()
  const { addMessage, updateMessage, removeMessage } = useChatStore()

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
      onConnect: (_frame: IFrame) => {
        // 새 메시지
        client.subscribe(`/topic/channel/${channelId}`, (msg: IMessage) => {
          const body = JSON.parse(msg.body) as ChatMessage

          // parentId가 없는 메시지만 채널 스토어에 추가
          if (!body.parentId) {
            addMessage(channelId, body)
          }

          // 스레드 패널에 전달하는 커스텀 이벤트 (parentId 있든 없든 발생)
          window.dispatchEvent(new CustomEvent('ws:channel-message', { detail: body }))
        })

        // 메시지 수정
        client.subscribe(
          `/topic/channel/${channelId}/update`,
          (msg: IMessage) => {
            const body = JSON.parse(msg.body) as ChatMessage
            updateMessage(channelId, body)
          }
        )

        // 메시지 삭제
        client.subscribe(
          `/topic/channel/${channelId}/delete`,
          (msg: IMessage) => {
            removeMessage(channelId, msg.body)
          }
        )
      },
      onStompError: (_frame: IFrame) => {
        console.error('STOMP 연결 오류가 발생했습니다.')
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
    }
  }, [accessToken, channelId, workspaceId, addMessage, updateMessage, removeMessage])

  return { sendMessage, isConnected: !!clientRef.current?.connected }
}
