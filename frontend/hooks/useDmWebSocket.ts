'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Client, type IMessage, type IFrame } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuthStore } from '@/store/authStore'
import type { DmMessage } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8080'

interface UseDmWebSocketOptions {
  workspaceId: string
  targetUserId: string
  currentUserId: string
  onMessage: (msg: DmMessage) => void
  onUpdate: (msg: DmMessage) => void
  onDelete: (dmId: string) => void
}

export function useDmWebSocket({
  workspaceId,
  targetUserId,
  currentUserId,
  onMessage,
  onUpdate,
  onDelete,
}: UseDmWebSocketOptions) {
  const clientRef = useRef<Client | null>(null)
  const { accessToken } = useAuthStore()

  const sendMessage = useCallback(
    (content: string) => {
      if (!clientRef.current?.connected) return
      clientRef.current.publish({
        destination: `/app/dm/${workspaceId}/${targetUserId}/send`,
        body: JSON.stringify({ content }),
      })
    },
    [workspaceId, targetUserId]
  )

  useEffect(() => {
    if (!accessToken || !currentUserId) return

    // 결정론적 토픽 경로 (서버와 동일 로직)
    const a = currentUserId
    const b = targetUserId
    const pair = a < b ? `${a}_${b}` : `${b}_${a}`
    const topic = `/topic/dm/${workspaceId}/${pair}`

    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`${WS_URL}/ws?token=${accessToken}`),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 5000,
      onConnect: (_frame: IFrame) => {
        client.subscribe(topic, (msg: IMessage) => {
          onMessage(JSON.parse(msg.body) as DmMessage)
        })
        client.subscribe(`${topic}/update`, (msg: IMessage) => {
          onUpdate(JSON.parse(msg.body) as DmMessage)
        })
        client.subscribe(`${topic}/delete`, (msg: IMessage) => {
          onDelete(msg.body)
        })
      },
      onStompError: (_frame: IFrame) => {
        console.error('DM STOMP 연결 오류')
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
    }
  }, [accessToken, workspaceId, targetUserId, currentUserId, onMessage, onUpdate, onDelete])

  return { sendMessage }
}
