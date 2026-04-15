'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Client, type IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuthStore } from '@/store/authStore'
import type { DmMessage, Reaction } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8080'

interface UseDmWebSocketOptions {
  workspaceId: string
  targetUserId: string
  currentUserId: string
  onMessage: (msg: DmMessage) => void
  onUpdate: (msg: DmMessage) => void
  onDelete: (dmId: string) => void
  onReactionAdd?: (reaction: Reaction) => void
  onReactionRemove?: (reaction: Reaction) => void
}

export function useDmWebSocket({
  workspaceId,
  targetUserId,
  currentUserId,
  onMessage,
  onUpdate,
  onDelete,
  onReactionAdd,
  onReactionRemove,
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

    const a = currentUserId
    const b = targetUserId
    const pair = a < b ? `${a}_${b}` : `${b}_${a}`
    const topic = `/topic/dm/${workspaceId}/${pair}`

    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`${WS_URL}/ws?token=${accessToken}`),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(topic, (msg: IMessage) => {
          onMessage(JSON.parse(msg.body) as DmMessage)
        })
        client.subscribe(`${topic}/update`, (msg: IMessage) => {
          onUpdate(JSON.parse(msg.body) as DmMessage)
        })
        client.subscribe(`${topic}/delete`, (msg: IMessage) => {
          onDelete(msg.body)
        })
        if (onReactionAdd) {
          client.subscribe(`${topic}/reactions`, (msg: IMessage) => {
            onReactionAdd(JSON.parse(msg.body) as Reaction)
          })
        }
        if (onReactionRemove) {
          client.subscribe(`${topic}/reactions/remove`, (msg: IMessage) => {
            onReactionRemove(JSON.parse(msg.body) as Reaction)
          })
        }
      },
      onStompError: () => {},
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
    }
  }, [accessToken, workspaceId, targetUserId, currentUserId, onMessage, onUpdate, onDelete, onReactionAdd, onReactionRemove])

  return { sendMessage }
}
