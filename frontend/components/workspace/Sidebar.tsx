'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { User, Mail, Bell, Settings, LogOut, Camera } from 'lucide-react'

import {
  workspaceApi, channelApi, userApi,
  presenceApi, unreadApi, notificationApi, type ApiResponse,
} from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useNotifications } from '@/hooks/useNotifications'
import { usePresenceStore } from '@/store/presenceStore'
import { useUnreadStore } from '@/store/unreadStore'
import type { Channel, WorkspaceMember } from '@/types'
import { toast } from 'sonner'

import styles from './sidebar.module.css'

const channelSchema = z.object({
  name: z.string().min(1, '채널 이름은 필수입니다.').max(100),
  description: z.string().optional(),
  isPrivate: z.boolean(),
})
type ChannelFormValues = z.infer<typeof channelSchema>

function presenceLabelOf(emoji?: string | null): string {
  switch (emoji) {
    case '🟡': return '자리비움'
    case '🔴': return '방해금지'
    case '⚪': return '오프라인'
    case '🟢':
    default: return '온라인'
  }
}

function presenceColorOf(emoji?: string | null): string {
  switch (emoji) {
    case '🟡': return '#eab308'
    case '🔴': return '#ef4444'
    case '⚪': return '#97979b'
    case '🟢':
    default: return '#03C75A'
  }
}

interface SidebarProps {
  workspaceId: string
}

export function Sidebar({ workspaceId }: SidebarProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { clearAuth } = useAuthStore()
  const { currentChannel, setCurrentChannel } = useWorkspaceStore()

  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState({ displayName: '', statusMessage: '', statusEmoji: '', presence: 'online', notificationsEnabled: true })

  const wsDropdownRef = useRef<HTMLDivElement>(null)

  useNotifications()

  const { setNotifications } = useNotificationStore()
  const { setOnlineIds, getOnlineSet } = usePresenceStore()
  const { channelUnread, dmUnread, setChannelCounts, clearChannel } = useUnreadStore()

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspaceApi.getOne(workspaceId).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const { data: channels = [] } = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: () => channelApi.getChannels(workspaceId).then((r) => r.data.data),
    staleTime: 30_000,
  })

  const { data: members = [] } = useQuery<WorkspaceMember[]>({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspaceApi.getMembers(workspaceId).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => userApi.getMe().then((r) => r.data.data),
    staleTime: 5 * 60_000,
  })

  useQuery({
    queryKey: ['unread-counts', workspaceId],
    queryFn: async () => {
      const counts = await unreadApi.getCounts(workspaceId).then((r) => r.data.data)
      setChannelCounts(counts)
      return counts
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  })

  useQuery({
    queryKey: ['presence', workspaceId],
    queryFn: async () => {
      const ids = await presenceApi.getOnlineUsers(workspaceId).then((r) => r.data.data)
      setOnlineIds(workspaceId, ids)
      return ids
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  })

  useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getAll().then((r) => {
      setNotifications(r.data.data)
      return r.data.data
    }),
    staleTime: 60_000,
  })

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: { name: '', description: '', isPrivate: false },
  })

  const { mutate: createChannel, isPending } = useMutation({
    mutationFn: (values: ChannelFormValues) => channelApi.create(workspaceId, values),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['channels', workspaceId] })
      setChannelDialogOpen(false)
      form.reset()
      setCurrentChannel(res.data.data)
      router.push(`/workspace/${workspaceId}/channel/${res.data.data.id}`)
      toast.success(`#${res.data.data.name} 채널이 생성되었습니다.`)
    },
    onError: (error: AxiosError<ApiResponse<null>>) => {
      const msg = error.response?.data?.message ?? '채널 생성 중 오류가 발생했습니다.'
      setServerError(msg)
      toast.error(msg)
    },
  })

  const { mutate: inviteMember, isPending: isInviting } = useMutation({
    mutationFn: (email: string) => workspaceApi.invite(workspaceId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] })
      setInviteDialogOpen(false)
      setInviteEmail('')
      setInviteError(null)
      toast.success('멤버를 초대했습니다.')
    },
    onError: (error: AxiosError<ApiResponse<null>>) => {
      const msg = error.response?.data?.message ?? '초대 중 오류가 발생했습니다.'
      setInviteError(msg)
      toast.error(msg)
    },
  })

  const { mutate: updateProfile, isPending: isUpdatingProfile } = useMutation({
    mutationFn: () => userApi.updateProfile({
      displayName: profileForm.displayName || undefined,
      statusMessage: profileForm.statusMessage,
      statusEmoji: profileForm.statusEmoji,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setProfileDialogOpen(false)
      toast.success('프로필이 저장되었습니다.')
    },
    onError: () => toast.error('프로필 저장에 실패했습니다.'),
  })

  function handleProfileOpen() {
    const currentEmoji = me?.statusEmoji ?? '🟢'
    const emojiToPresence: Record<string, string> = {
      '🟢': 'online', '🟡': 'away', '🔴': 'dnd', '⚪': 'offline',
    }
    setProfileForm({
      displayName: me?.displayName ?? '',
      statusMessage: me?.statusMessage ?? '',
      statusEmoji: emojiToPresence[currentEmoji] ? currentEmoji : '🟢',
      presence: emojiToPresence[currentEmoji] ?? 'online',
      notificationsEnabled: true,
    })
    setProfileDialogOpen(true)
  }

  const presenceOptions: { value: string; emoji: string; label: string }[] = [
    { value: 'online', emoji: '🟢', label: '온라인' },
    { value: 'away', emoji: '🟡', label: '자리비움' },
    { value: 'dnd', emoji: '🔴', label: '방해금지' },
    { value: 'offline', emoji: '⚪', label: '오프라인' },
  ]

  function handleLogout() {
    clearAuth()
    queryClient.clear()
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    } else {
      router.replace('/')
    }
  }

  function handleChannelClick(channel: Channel) {
    setCurrentChannel(channel)
    clearChannel(channel.id)
    router.push(`/workspace/${workspaceId}/channel/${channel.id}`)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wsDropdownOpen && wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node)) {
        setWsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [wsDropdownOpen])

  const myMemberId = me?.id
  const onlineSet = getOnlineSet(workspaceId)
  const displayName = me?.displayName ?? me?.username ?? '...'

  return (
    <aside className={styles.sidebar}>

      <div className={styles.workspaceHeader}>
        <div ref={wsDropdownRef} className={styles.wsHeaderFlex}>
          <div
            className={styles.workspaceLogoAvatar}
            onClick={() => router.push('/workspace')}
            title="워크스페이스 목록"
          >
            {workspace?.name?.charAt(0).toUpperCase() ?? 'W'}
          </div>
          <button className={styles.workspaceNameBtn} onClick={() => setWsDropdownOpen((o) => !o)}>
            <span className={styles.workspaceName}>{workspace?.name ?? '...'}</span>
            <span className={styles.wsDropdownArrow}>{wsDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {wsDropdownOpen && (
            <div className={styles.wsDropdown}>
              <button
                className={styles.wsDropdownItem}
                onClick={() => {
                  setWsDropdownOpen(false)
                  if (typeof window !== 'undefined') {
                    window.location.href = '/'
                  } else {
                    router.push('/')
                  }
                }}
              >
                🏠 메인 홈
              </button>
              <button className={styles.wsDropdownItem} onClick={() => { setWsDropdownOpen(false); router.push('/workspace') }}>
                ↩ 워크스페이스 목록
              </button>
              <button className={styles.wsDropdownItem} onClick={() => { setWsDropdownOpen(false); setInviteDialogOpen(true) }}>
                ✉ 멤버 초대
              </button>
              <button className={styles.wsDropdownItem} onClick={() => { setWsDropdownOpen(false); handleLogout() }}>
                🚪 로그아웃
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.scrollArea}>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>채널</span>
            <button className={styles.addBtn} onClick={() => setChannelDialogOpen(true)} aria-label="채널 추가">+</button>
          </div>
          {channels.map((ch) => {
            const unread = channelUnread[ch.id] ?? 0
            return (
              <div
                key={ch.id}
                className={`${styles.channelItem} ${currentChannel?.id === ch.id ? styles.active : ''}`}
                onClick={() => handleChannelClick(ch)}
              >
                <span className={styles.channelHash}>#</span>
                <span className={styles.channelName}>{ch.name}</span>
                {unread > 0 && (
                  <span className={styles.unreadBadge}>{unread > 99 ? '99+' : unread}</span>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>다이렉트 메시지</span>
            <button className={styles.addBtn} aria-label="멤버 초대" onClick={() => setInviteDialogOpen(true)}>+</button>
          </div>
          {members
            .filter((m) => m.userId !== myMemberId)
            .map((m) => {
              const dmUnreadCount = dmUnread[m.userId] ?? 0
              const isOnline = onlineSet.has(m.userId)
              return (
                <div
                  key={m.userId}
                  className={styles.dmItem}
                  onClick={() => {
                    useUnreadStore.getState().clearDm(m.userId)
                    router.push(`/workspace/${workspaceId}/dm/${m.userId}`)
                  }}
                >
                  <span
                    className={`${styles.onlineDot} ${isOnline ? styles.onlineDotPulse : ''} ${isOnline ? styles.onlineDotOnline : styles.onlineDotOffline}`}
                  />
                  <span className={styles.channelName}>{m.displayName ?? m.username}</span>
                  {dmUnreadCount > 0 && (
                    <span className={styles.unreadBadge}>{dmUnreadCount > 99 ? '99+' : dmUnreadCount}</span>
                  )}
                </div>
              )
            })}
        </div>
      </div>

      <div className={styles.profileFooter}>
        <div className={styles.profileInfo} onClick={handleProfileOpen}>
          <div className={styles.profileAvatar}>
            {displayName.charAt(0).toUpperCase()}
            <span
              className={styles.profileOnlineDot}
              style={{ background: presenceColorOf(me?.statusEmoji) }}
            />
          </div>
          <div className={styles.profileInfoContent}>
            <div className={styles.profileName}>{displayName}</div>
            <div className={styles.profileStatus}>
              {me?.statusMessage || presenceLabelOf(me?.statusEmoji)}
            </div>
          </div>
        </div>
        <button className={styles.logoutBtn} title="로그아웃" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={(o) => { setInviteDialogOpen(o); setInviteError(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>멤버 초대</DialogTitle>
            <DialogDescription>이메일 주소로 워크스페이스에 멤버를 초대합니다.</DialogDescription>
          </DialogHeader>
          <div className={styles.formField}>
            <label className={styles.inviteLabel}>이메일</label>
            <Input
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') inviteMember(inviteEmail) }}
            />
            {inviteError && <p className={styles.errorMsg}>{inviteError}</p>}
          </div>
          <Button onClick={() => inviteMember(inviteEmail)} disabled={isInviting || !inviteEmail.trim()} className={styles.fullWidthBtn}>
            {isInviting ? '초대 중...' : '초대하기'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>채널 만들기</DialogTitle>
            <DialogDescription>새 채널 이름과 설명을 입력하세요.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => { setServerError(null); createChannel(v) })}>
              {serverError && <p className={styles.serverError}>{serverError}</p>}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className={styles.formField}>
                  <FormLabel>채널 이름</FormLabel>
                  <FormControl><Input placeholder="general" {...field} /></FormControl>
                  <FormMessage className={styles.errorMsg} />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem className={styles.formField}>
                  <FormLabel>설명 (선택)</FormLabel>
                  <FormControl><Input placeholder="채널 설명" {...field} /></FormControl>
                  <FormMessage className={styles.errorMsg} />
                </FormItem>
              )} />
              <Button type="submit" disabled={isPending} className={styles.fullWidthBtn}>
                {isPending ? '생성 중...' : '채널 만들기'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className={styles.profileModalContent}>
          <DialogHeader className={styles.profileModalHeader}>
            <DialogTitle className={styles.profileModalTitle}>프로필 설정</DialogTitle>
            <DialogDescription className={styles.profileModalSub}>
              프로필 정보와 알림 설정을 관리하세요.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.profileModalBody}>
            <div className={styles.profileHeroRow}>
              <div className={styles.profileHeroAvatar}>
                {me?.avatarUrl ? (
                  <img src={me.avatarUrl} alt="" className={styles.profileHeroAvatarImg} />
                ) : (
                  <User size={42} strokeWidth={2.25} />
                )}
              </div>
              <div className={styles.profileHeroInfo}>
                <p className={styles.profileHeroName}>
                  {profileForm.displayName || me?.username || '사용자'}
                </p>
                <p className={styles.profileHeroEmail}>{me?.email ?? ''}</p>
                <button type="button" className={styles.profileAvatarChangeBtn}>
                  <Camera size={14} />
                  프로필 사진 변경
                </button>
              </div>
            </div>

            <div className={styles.profileFormField}>
              <label className={styles.profileFormLabel}>
                <User size={14} /> 이름
              </label>
              <input
                className={styles.profileFormInput}
                placeholder={me?.username ?? ''}
                value={profileForm.displayName}
                onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>

            <div className={styles.profileFormField}>
              <label className={styles.profileFormLabel}>
                <Mail size={14} /> 이메일
              </label>
              <input
                className={styles.profileFormInput}
                value={me?.email ?? ''}
                readOnly
              />
            </div>

            <div className={styles.profileFormField}>
              <label className={styles.profileFormLabel}>상태</label>
              <div className={styles.profileSelectWrap}>
                <select
                  className={styles.profileSelect}
                  value={profileForm.presence}
                  onChange={(e) => {
                    const opt = presenceOptions.find((o) => o.value === e.target.value)
                    setProfileForm((f) => ({
                      ...f,
                      presence: e.target.value,
                      statusEmoji: opt?.emoji ?? f.statusEmoji,
                    }))
                  }}
                >
                  {presenceOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.emoji}  {o.label}</option>
                  ))}
                </select>
                <span className={styles.profileSelectChevron}>▾</span>
              </div>
            </div>

            <div className={styles.profileFormField}>
              <label className={styles.profileFormLabel}>상태 메시지</label>
              <input
                className={styles.profileFormInput}
                placeholder="예: 🍣 점심 먹는 중"
                value={profileForm.statusMessage}
                onChange={(e) => setProfileForm((f) => ({ ...f, statusMessage: e.target.value }))}
              />
            </div>

            <div className={styles.profileSettingRow}>
              <div className={styles.profileSettingIcon}>
                <Bell size={18} />
              </div>
              <div className={styles.profileSettingText}>
                <p className={styles.profileSettingTitle}>알림 받기</p>
                <p className={styles.profileSettingSub}>새 메시지 및 멘션 알림</p>
              </div>
              <button
                type="button"
                className={`${styles.profileToggle} ${profileForm.notificationsEnabled ? styles.profileToggleOn : ''}`}
                onClick={() => setProfileForm((f) => ({ ...f, notificationsEnabled: !f.notificationsEnabled }))}
                aria-pressed={profileForm.notificationsEnabled}
              >
                <span className={styles.profileToggleKnob} />
              </button>
            </div>

            <button type="button" className={styles.profileSettingRow}>
              <div className={styles.profileSettingIcon}>
                <Settings size={18} />
              </div>
              <div className={styles.profileSettingText}>
                <p className={styles.profileSettingTitle}>설정</p>
                <p className={styles.profileSettingSub}>환경설정 및 개인정보</p>
              </div>
              <span className={styles.profileSettingChevron}>›</span>
            </button>

            <button
              type="button"
              className={`${styles.profileSettingRow} ${styles.profileSettingRowDanger}`}
              onClick={() => { setProfileDialogOpen(false); handleLogout() }}
            >
              <div className={`${styles.profileSettingIcon} ${styles.profileSettingIconDanger}`}>
                <LogOut size={18} />
              </div>
              <div className={styles.profileSettingText}>
                <p className={`${styles.profileSettingTitle} ${styles.profileSettingTitleDanger}`}>로그아웃</p>
                <p className={styles.profileSettingSub}>모든 워크스페이스에서 로그아웃</p>
              </div>
            </button>
          </div>

          <div className={styles.profileModalFooter}>
            <button
              type="button"
              className={styles.profileCancelBtn}
              onClick={() => setProfileDialogOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.profileSaveBtn}
              onClick={() => updateProfile()}
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? '저장 중...' : '저장'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </aside>
  )
}
