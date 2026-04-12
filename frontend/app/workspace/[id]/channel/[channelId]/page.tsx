'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { channelApi } from '@/lib/api'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { ChatArea } from '@/components/chat/ChatArea'
import styles from '../../layout.module.css'

interface Props {
  params: Promise<{ id: string; channelId: string }>
}

export default function ChannelPage({ params }: Props) {
  const { id: workspaceId, channelId } = use(params)
  const { setCurrentChannel } = useWorkspaceStore()

  const { data: channel, isLoading } = useQuery({
    queryKey: ['channel', workspaceId, channelId],
    queryFn: () => channelApi.getOne(workspaceId, channelId).then((r) => r.data.data),
  })

  useEffect(() => {
    if (channel) {
      setCurrentChannel(channel)
    }
  }, [channel, setCurrentChannel])

  if (isLoading) {
    return (
      <div className={styles.contentArea}>
        <div className={styles.placeholder}>
          <p className={styles.placeholderTitle}>불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!channel) {
    return (
      <div className={styles.contentArea}>
        <div className={styles.placeholder}>
          <p className={styles.placeholderTitle}>채널을 찾을 수 없습니다</p>
        </div>
      </div>
    )
  }

  return <ChatArea workspaceId={workspaceId} channel={channel} />
}
