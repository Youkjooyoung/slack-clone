'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './animated-chat.module.css'

interface DemoMessage {
  user: string
  msg: string
  color: string
}

const demoMessages: DemoMessage[] = [
  { user: '김기수', msg: '안녕하세요! 새로운 프로젝트 시작했습니다.', color: '#03C75A' },
  { user: '이서연', msg: '좋아요! 확인했습니다 👍', color: '#02b876' },
  { user: '박민준', msg: '디자인 시안 공유드립니다. 피드백 부탁드려요!', color: '#1164a3' },
  { user: '최지우', msg: '멋지네요! 바로 확인해볼게요 ✨', color: '#7c3aed' },
]

interface DisplayMessage extends DemoMessage {
  displayText: string
  isComplete: boolean
}

export default function AnimatedChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const resetRef = useRef<number>(0)

  useEffect(() => {
    const reset = () => {
      setMessages([])
      setIsTyping(false)
      setCurrentIdx(0)
      resetRef.current++
    }

    const startTimer = window.setTimeout(reset, 500)
    const loopTimer = window.setInterval(reset, 20000)
    return () => {
      window.clearTimeout(startTimer)
      window.clearInterval(loopTimer)
    }
  }, [])

  useEffect(() => {
    if (currentIdx >= demoMessages.length) return

    const gen = resetRef.current
    const msg = demoMessages[currentIdx]

    setIsTyping(true)
    const typingDelay = window.setTimeout(() => {
      if (gen !== resetRef.current) return
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        { ...msg, displayText: '', isComplete: false },
      ])

      let charIdx = 0
      const typeInterval = window.setInterval(() => {
        if (gen !== resetRef.current) {
          window.clearInterval(typeInterval)
          return
        }
        charIdx++
        setMessages((prev) => {
          const next = [...prev]
          const last = next.length - 1
          if (next[last]) {
            next[last] = {
              ...next[last],
              displayText: msg.msg.substring(0, charIdx),
              isComplete: charIdx >= msg.msg.length,
            }
          }
          return next
        })

        if (charIdx >= msg.msg.length) {
          window.clearInterval(typeInterval)
          window.setTimeout(() => {
            if (gen !== resetRef.current) return
            setCurrentIdx((prev) => prev + 1)
          }, 800)
        }
      }, 30)
    }, 1000)

    return () => window.clearTimeout(typingDelay)
  }, [currentIdx])

  return (
    <div className={styles.root}>
      {messages.map((m, i) => (
        <div key={`${resetRef.current}-${i}`} className={styles.row}>
          <div className={styles.avatar} style={{ background: m.color }}>
            {m.user}
          </div>
          <div className={styles.bubble}>
            {m.displayText}
            {!m.isComplete && <span className={styles.cursor} />}
          </div>
        </div>
      ))}

      {isTyping && (
        <div className={styles.row}>
          <div className={`${styles.avatar} ${styles.avatarTyping}`}>⋯</div>
          <div className={styles.typingDots}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        </div>
      )}
    </div>
  )
}
