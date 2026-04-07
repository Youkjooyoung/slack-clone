'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

import { workspaceApi, channelApi, userApi, type ApiResponse } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import type { Channel, WorkspaceMember } from '@/types'
import styles from './sidebar.module.css'

const channelSchema = z.object({
  name: z.string().min(1, '채널 이름은 필수입니다.').max(100),
  description: z.string().optional(),
  isPrivate: z.boolean(),
})
type ChannelFormValues = z.infer<typeof channelSchema>

interface SidebarProps {
  workspaceId: string
}

export function Sidebar({ workspaceId }: SidebarProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { clearAuth } = useAuthStore()
  const { currentChannel, setCurrentChannel } = useWorkspaceStore()

  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId).then((r) => r.data.data),
  })

  const { data: channels = [] } = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: () => channelApi.getChannels(workspaceId).then((r) => r.data.data),
  })

  const { data: members = [] } = useQuery<WorkspaceMember[]>({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getMembers(workspaceId).then((r) => r.data.data),
  })

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => userApi.getMe().then((r) => r.data.data),
  })

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: { name: '', description: '', isPrivate: false },
  })

  const { mutate: createChannel, isPending } = useMutation({
    mutationFn: (values: ChannelFormValues) =>
      channelApi.create(workspaceId, values),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['channels', workspaceId] })
      setChannelDialogOpen(false)
      form.reset()
      setCurrentChannel(res.data.data)
    },
    onError: (error: AxiosError<ApiResponse<null>>) => {
      setServerError(error.response?.data?.message ?? '채널 생성 중 오류가 발생했습니다.')
    },
  })

  function handleChannelClick(channel: Channel) {
    setCurrentChannel(channel)
  }

  function handleLogout() {
    clearAuth()
    router.push('/auth/login')
  }

  const myMemberId = me?.id

  return (
    <aside className={styles.sidebar}>
      {/* 워크스페이스 헤더 */}
      <div
        className={styles.workspaceHeader}
        onClick={() => router.push('/workspace')}
      >
        <span className={styles.workspaceName}>{workspace?.name ?? '...'}</span>
        <button className={styles.newMsgBtn} aria-label="새 메시지">✏</button>
      </div>

      {/* 스크롤 영역 */}
      <div className={styles.scrollArea}>
        {/* 채널 섹션 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>채널</span>
            <button
              className={styles.addBtn}
              onClick={() => setChannelDialogOpen(true)}
              aria-label="채널 추가"
            >
              +
            </button>
          </div>
          {channels.map((ch) => (
            <div
              key={ch.id}
              className={`${styles.channelItem} ${currentChannel?.id === ch.id ? styles.active : ''}`}
              onClick={() => handleChannelClick(ch)}
            >
              <span className={styles.channelHash}>#</span>
              <span className={styles.channelName}>{ch.name}</span>
            </div>
          ))}
        </div>

        {/* DM 섹션 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>다이렉트 메시지</span>
            <button className={styles.addBtn} aria-label="DM 추가">+</button>
          </div>
          {members
            .filter((m) => m.userId !== myMemberId)
            .map((m) => (
              <div key={m.userId} className={styles.dmItem}>
                <span className={styles.onlineDot} />
                <span className={styles.channelName}>
                  {m.displayName ?? m.username}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* 프로필 푸터 */}
      <div className={styles.profileFooter} onClick={handleLogout}>
        <Avatar style={{ width: 32, height: 32 }}>
          <AvatarImage src={me?.avatarUrl ?? undefined} />
          <AvatarFallback style={{ fontSize: '0.75rem', backgroundColor: '#4f46e5', color: '#fff' }}>
            {me?.username?.charAt(0).toUpperCase() ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className={styles.profileName}>{me?.displayName ?? me?.username ?? '...'}</p>
          <p className={styles.profileStatus}>로그아웃</p>
        </div>
      </div>

      {/* 채널 생성 다이얼로그 */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>채널 만들기</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => { setServerError(null); createChannel(v) })}>
              {serverError && <p className={styles.serverError}>{serverError}</p>}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className={styles.formField}>
                    <FormLabel>채널 이름</FormLabel>
                    <FormControl>
                      <Input placeholder="general" {...field} />
                    </FormControl>
                    <FormMessage className={styles.errorMsg} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className={styles.formField}>
                    <FormLabel>설명 (선택)</FormLabel>
                    <FormControl>
                      <Input placeholder="채널 설명" {...field} />
                    </FormControl>
                    <FormMessage className={styles.errorMsg} />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isPending} style={{ width: '100%' }}>
                {isPending ? '생성 중...' : '채널 만들기'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
