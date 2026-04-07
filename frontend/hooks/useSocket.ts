'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/useAuthStore'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const token = useAuthStore((state) => state.token)

  useEffect(() => {
    if (!token) return

    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    })

    socketRef.current.on('connect', () => {
      console.log('Socket connected')
    })

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    return () => {
      socketRef.current?.disconnect()
    }
  }, [token])

  return socketRef.current
}
