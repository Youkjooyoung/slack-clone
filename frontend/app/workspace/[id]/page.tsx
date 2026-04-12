'use client'

import { use } from 'react'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { ChatArea } from '@/components/chat/ChatArea'
import styles from './layout.module.css'

interface Props {
  params: Promise<{ id: string }>
}

export default function WorkspacePage({ params }: Props) {
  const { id: workspaceId } = use(params)
  const { currentChannel } = useWorkspaceStore()

  if (currentChannel) {
    return (
      <ChatArea workspaceId={workspaceId} channel={currentChannel} />
    )
  }

  return (
    <div className={styles.contentArea}>
      <div className={styles.placeholder}>
        <p className={styles.placeholderTitle}>채널을 선택하세요</p>
        <p className={styles.placeholderSub}>
          좌측 사이드바에서 채널을 선택하거나 새 채널을 만들어보세요.
        </p>
      </div>
    </div>
  )
}
