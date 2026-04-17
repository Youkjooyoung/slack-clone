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

  const onMessageRef = useRef(onMessage)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  const onReactionAddRef = useRef(onReactionAdd)
  const onReactionRemoveRef = useRef(onReactionRemove)

  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])
  useEffect(() => { onReactionAddRef.current = onReactionAdd }, [onReactionAdd])
  useEffect(() => { onReactionRemoveRef.current = onReactionRemove }, [onReactionRemove])

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
          onMessageRef.current(JSON.parse(msg.body) as DmMessage)
        })
        client.subscribe(`${topic}/update`, (msg: IMessage) => {
          onUpdateRef.current(JSON.parse(msg.body) as DmMessage)
        })
        client.subscribe(`${topic}/delete`, (msg: IMessage) => {
          onDeleteRef.current(msg.body)
        })
        client.subscribe(`${topic}/reactions`, (msg: IMessage) => {
          onReactionAddRef.current?.(JSON.parse(msg.body) as Reaction)
        })
        client.subscribe(`${topic}/reactions/remove`, (msg: IMessage) => {
          onReactionRemoveRef.current?.(JSON.parse(msg.body) as Reaction)
        })
      },
      onStompError: () => {},
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
    }
  }, [accessToken, workspaceId, targetUserId, currentUserId])

  return { sendMessage }
}
