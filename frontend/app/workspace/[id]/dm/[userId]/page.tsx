'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { DmArea } from '@/components/dm/DmArea'
import type { UserProfile, WorkspaceMember } from '@/types'
import styles from '../../layout.module.css'

interface Props {
  params: Promise<{ id: string; userId: string }>
}

export default function DmPage({ params }: Props) {
  const { id: workspaceId, userId: targetUserId } = use(params)
  const { user } = useAuthStore()

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getMembers(workspaceId).then((r) => r.data.data),
  })

  if (isLoading) {
    return (
      <div className={styles.contentArea}>
        <div className={styles.placeholder}>
          <p className={styles.placeholderTitle}>불러오는 중...</p>
        </div>
      </div>
    )
  }

  const targetMember = members.find((m: WorkspaceMember) => m.userId === targetUserId)

  if (!targetMember) {
    return (
      <div className={styles.contentArea}>
        <div className={styles.placeholder}>
          <p className={styles.placeholderTitle}>사용자를 찾을 수 없습니다</p>
        </div>
      </div>
    )
  }

  const targetUser: UserProfile = {
    id: targetMember.userId,
    email: targetMember.email,
    username: targetMember.username,
    displayName: targetMember.displayName,
    avatarUrl: targetMember.avatarUrl,
    statusMessage: null,
    statusEmoji: null,
    isOnline: false,
  }

  return <DmArea workspaceId={workspaceId} targetUser={targetUser} />
}
