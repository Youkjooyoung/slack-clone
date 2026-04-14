'use client'

import { useEffect, useRef } from 'react'
import { Client, type IMessage, type IFrame } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useUnreadStore } from '@/store/unreadStore'
import type { AppNotification } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8080'

interface UnreadEvent {
  type: 'CHANNEL' | 'DM'
  channelId?: string
  fromUserId?: string
  workspaceId: string
}

export function useNotifications() {
  const clientRef = useRef<Client | null>(null)
  const { accessToken } = useAuthStore()
  const { addNotification } = useNotificationStore()
  const { incrementChannel, incrementDm } = useUnreadStore()

  useEffect(() => {
    if (!accessToken) return

    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`${WS_URL}/ws?token=${accessToken}`),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 10_000,
      onConnect: (_frame: IFrame) => {
        // 멘션/알림
        client.subscribe('/user/queue/notifications', (msg: IMessage) => {
          const notification = JSON.parse(msg.body) as AppNotification
          addNotification(notification)
          toast(notification.title, {
            description: notification.content,
            duration: 5000,
          })
        })

        // 채널·DM unread 실시간 이벤트
        client.subscribe('/user/queue/unread', (msg: IMessage) => {
          const event = JSON.parse(msg.body) as UnreadEvent
          if (event.type === 'CHANNEL' && event.channelId) {
            incrementChannel(event.channelId)
          } else if (event.type === 'DM' && event.fromUserId) {
            incrementDm(event.fromUserId)
          }
        })
      },
      onStompError: (_frame: IFrame) => {
        console.error('Notification STOMP error')
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
    }
  }, [accessToken, addNotification, incrementChannel, incrementDm])
}
