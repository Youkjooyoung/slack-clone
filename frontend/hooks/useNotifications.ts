'use client'

import { useEffect, useRef } from 'react'
import { Client, type IMessage, type IFrame } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import type { AppNotification } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:8080'

export function useNotifications() {
  const clientRef = useRef<Client | null>(null)
  const { accessToken } = useAuthStore()
  const { addNotification } = useNotificationStore()

  useEffect(() => {
    if (!accessToken) return

    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`${WS_URL}/ws?token=${accessToken}`),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 10_000,
      onConnect: (_frame: IFrame) => {
        client.subscribe('/user/queue/notifications', (msg: IMessage) => {
          const notification = JSON.parse(msg.body) as AppNotification
          addNotification(notification)
          toast(notification.title, {
            description: notification.content,
            duration: 5000,
          })
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
  }, [accessToken, addNotification])
}
