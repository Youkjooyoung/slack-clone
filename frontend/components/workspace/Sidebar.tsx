'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

import {
  workspaceApi, channelApi, userApi, notificationApi,
  presenceApi, unreadApi, type ApiResponse,
} from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useNotifications } from '@/hooks/useNotifications'
import { useLayoutStore, THEMES, type ThemeId } from '@/store/layoutStore'
import type { Channel, WorkspaceMember } from '@/types'
import { toast } from 'sonner'

import { HomePanel } from './panels/HomePanel'
import { ActivityPanel } from './panels/ActivityPanel'
import { FilesPanel } from './panels/FilesPanel'
import { MorePanel } from './panels/MorePanel'
import styles from './sidebar.module.css'

type Tab = 'home' | 'dm' | 'activity' | 'files' | 'more'

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
  const { theme } = useLayoutStore()

  const [activeTab, setActiveTab] = useState<Tab>('dm')
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState({ displayName: '', statusMessage: '', statusEmoji: '' })
  const notifRef = useRef<HTMLDivElement>(null)
  const wsDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
      if (wsDropdownOpen && wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node)) {
        setWsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen, wsDropdownOpen])

  // Apply theme CSS variables
  useEffect(() => {
    const t = THEMES[theme as ThemeId] ?? THEMES.aubergine
    document.documentElement.style.setProperty('--icon-rail-bg', t.iconRailBg)
    document.documentElement.style.setProperty('--sidebar-bg-top', t.sidebarBgTop)
    document.documentElement.style.setProperty('--sidebar-bg-bottom', t.sidebarBgBottom)
    document.documentElement.style.setProperty('--sidebar-active', t.activeItemBg)
  }, [theme])

  useNotifications()

  const { notifications, unreadCount, setNotifications, markRead, markAllRead } = useNotificationStore()

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

  const { data: unreadCounts = {} } = useQuery({
    queryKey: ['unread-counts', workspaceId],
    queryFn: () => unreadApi.getCounts(workspaceId).then((r) => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const { data: onlineUserIds = [] } = useQuery({
    queryKey: ['presence', workspaceId],
    queryFn: () => presenceApi.getOnlineUsers(workspaceId).then((r) => r.data.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
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
    mutationFn: (values: ChannelFormValues) =>
      channelApi.create(workspaceId, values),
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
      statusMessage: profileForm.statusMessage || undefined,
      statusEmoji: profileForm.statusEmoji || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setProfileDialogOpen(false)
      toast.success('프로필이 저장되었습니다.')
    },
    onError: () => toast.error('프로필 저장에 실패했습니다.'),
  })

  function handleProfileOpen() {
    setProfileForm({
      displayName: me?.displayName ?? '',
      statusMessage: me?.statusMessage ?? '',
      statusEmoji: me?.statusEmoji ?? '',
    })
    setProfileDialogOpen(true)
  }

  function handleLogout() {
    clearAuth()
    router.push('/auth/login')
  }

  async function handleNotifRead(id: string) {
    markRead(id)
    await notificationApi.markAsRead(id).catch(() => null)
  }

  async function handleNotifReadAll() {
    markAllRead()
    await notificationApi.markAllAsRead().catch(() => null)
  }

  function handleChannelClick(channel: Channel) {
    setCurrentChannel(channel)
    router.push(`/workspace/${workspaceId}/channel/${channel.id}`)
    queryClient.invalidateQueries({ queryKey: ['unread-counts', workspaceId] })
  }

  const myMemberId = me?.id
  const onlineSet = new Set(onlineUserIds)

  const iconTabs: Array<{
    id: Tab
    icon: string
    label: string
    badge?: number
  }> = [
    { id: 'home', icon: '🏠', label: '홈' },
    { id: 'dm', icon: '💬', label: 'DM' },
    { id: 'activity', icon: '🔔', label: '활동', badge: unreadCount },
    { id: 'files', icon: '📁', label: '파일' },
  ]

  return (
    <aside className={styles.sidebar}>
      {/* ════════════ Icon Rail ════════════ */}
      <div className={styles.iconRail}>
        {/* Workspace avatar */}
        <div
          className={styles.workspaceAvatar}
          title={workspace?.name ?? '워크스페이스'}
          onClick={() => router.push('/workspace')}
        >
          {workspace?.name?.charAt(0).toUpperCase() ?? 'W'}
        </div>

        {/* Main nav tabs */}
        {iconTabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.iconTab} ${activeTab === tab.id ? styles.iconTabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span className={styles.iconTabIcon}>{tab.icon}</span>
            <span className={styles.iconTabLabel}>{tab.label}</span>
            {tab.badge && tab.badge > 0 ? (
              <span className={styles.iconBadge}>{tab.badge > 99 ? '99+' : tab.badge}</span>
            ) : null}
          </button>
        ))}

        <div className={styles.iconSep} />

        {/* 더보기 */}
        <button
          className={`${styles.iconTab} ${activeTab === 'more' ? styles.iconTabActive : ''}`}
          onClick={() => setActiveTab('more')}
          title="더보기"
        >
          <span className={styles.iconTabIcon}>⋯</span>
          <span className={styles.iconTabLabel}>더보기</span>
        </button>

        <div className={styles.iconRailFill} />
      </div>

      {/* ════════════ Side Panel ════════════ */}
      <div className={styles.sidePanel}>
        {/* Workspace header */}
        <div className={styles.workspaceHeader}>
          <div ref={wsDropdownRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <button
              className={styles.workspaceNameBtn}
              onClick={() => setWsDropdownOpen((o) => !o)}
            >
              <span className={styles.workspaceName}>
                {workspace?.name ?? '...'}
              </span>
              <span className={styles.wsDropdownArrow}>{wsDropdownOpen ? '▲' : '▼'}</span>
            </button>
            {wsDropdownOpen && (
              <div className={styles.wsDropdown}>
                <button
                  className={styles.wsDropdownItem}
                  onClick={() => { setWsDropdownOpen(false); router.push('/workspace') }}
                >
                  ↩ 워크스페이스 목록
                </button>
                <button
                  className={styles.wsDropdownItem}
                  onClick={() => { setWsDropdownOpen(false); setInviteDialogOpen(true) }}
                >
                  ✉ 멤버 초대
                </button>
                <button
                  className={styles.wsDropdownItem}
                  onClick={() => { setWsDropdownOpen(false); handleLogout() }}
                >
                  🚪 로그아웃
                </button>
              </div>
            )}
          </div>
          <div className={styles.headerBtns}>
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                className={styles.newMsgBtn}
                aria-label="알림"
                onClick={() => setNotifOpen((o) => !o)}
              >
                🔔
              </button>
              {unreadCount > 0 && (
                <span className={styles.notifBadge}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {/* Notification dropdown */}
              {notifOpen && (
                <div className={styles.notifPanel}>
                  <div className={styles.notifHeader}>
                    <span>알림</span>
                    <button className={styles.notifReadAll} onClick={handleNotifReadAll}>모두 읽음</button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className={styles.notifEmpty}>새 알림이 없습니다.</div>
                  ) : (
                    <div className={styles.notifList}>
                      {notifications.slice(0, 30).map((n) => (
                        <div
                          key={n.id}
                          className={`${styles.notifItem} ${n.isRead ? styles.notifRead : ''}`}
                          onClick={() => { handleNotifRead(n.id); setNotifOpen(false) }}
                        >
                          <p className={styles.notifTitle}>{n.title}</p>
                          <p className={styles.notifContent}>{n.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              className={styles.headerProfileBtn}
              onClick={handleProfileOpen}
              title={`${me?.displayName ?? me?.username ?? '프로필'} · 프로필 편집`}
            >
              {me?.username?.charAt(0).toUpperCase() ?? '?'}
            </button>
          </div>
        </div>

        {/* ── Tab content ── */}
        {activeTab === 'home' && (
          <HomePanel
            workspaceId={workspaceId}
            channels={channels}
            unreadCounts={unreadCounts}
            members={members}
            onlineSet={onlineSet}
            myMemberId={myMemberId}
            notifications={notifications}
            onChannelClick={handleChannelClick}
            onDmClick={(userId) => router.push(`/workspace/${workspaceId}/dm/${userId}`)}
          />
        )}

        {activeTab === 'dm' && (
          <div className={styles.scrollArea}>
            {/* Channels */}
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
              {channels.map((ch) => {
                const unread = unreadCounts[ch.id] ?? 0
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

            {/* DMs */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>다이렉트 메시지</span>
                <button
                  className={styles.addBtn}
                  aria-label="멤버 초대"
                  onClick={() => setInviteDialogOpen(true)}
                >
                  +
                </button>
              </div>
              {members
                .filter((m) => m.userId !== myMemberId)
                .map((m) => (
                  <div
                    key={m.userId}
                    className={styles.dmItem}
                    onClick={() => router.push(`/workspace/${workspaceId}/dm/${m.userId}`)}
                  >
                    <span
                      className={styles.onlineDot}
                      style={{ backgroundColor: onlineSet.has(m.userId) ? '#2bac76' : '#97979b' }}
                    />
                    <span className={styles.channelName}>{m.displayName ?? m.username}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <ActivityPanel
            notifications={notifications}
            onNotifRead={handleNotifRead}
            onReadAll={handleNotifReadAll}
          />
        )}

        {activeTab === 'files' && <FilesPanel />}

        {activeTab === 'more' && <MorePanel />}

      </div>

      {/* ════════════ Dialogs ════════════ */}

      {/* 멤버 초대 */}
      <Dialog open={inviteDialogOpen} onOpenChange={(o) => { setInviteDialogOpen(o); setInviteError(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>멤버 초대</DialogTitle>
            <DialogDescription>이메일 주소로 워크스페이스에 멤버를 초대합니다.</DialogDescription>
          </DialogHeader>
          <div className={styles.formField}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>이메일</label>
            <Input
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') inviteMember(inviteEmail) }}
            />
            {inviteError && <p className={styles.errorMsg}>{inviteError}</p>}
          </div>
          <Button onClick={() => inviteMember(inviteEmail)} disabled={isInviting || !inviteEmail.trim()} style={{ width: '100%' }}>
            {isInviting ? '초대 중...' : '초대하기'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* 채널 생성 */}
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
              <Button type="submit" disabled={isPending} style={{ width: '100%' }}>
                {isPending ? '생성 중...' : '채널 만들기'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 프로필 편집 */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로필 편집</DialogTitle>
            <DialogDescription>표시 이름과 상태를 변경합니다.</DialogDescription>
          </DialogHeader>
          <div className={styles.formField}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>표시 이름</label>
            <Input
              placeholder={me?.username ?? ''}
              value={profileForm.displayName}
              onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </div>
          <div className={styles.formField}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>상태 이모지</label>
            <Input
              placeholder="😊"
              value={profileForm.statusEmoji}
              onChange={(e) => setProfileForm((f) => ({ ...f, statusEmoji: e.target.value }))}
            />
          </div>
          <div className={styles.formField}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>상태 메시지</label>
            <Input
              placeholder="지금 무엇을 하고 있나요?"
              value={profileForm.statusMessage}
              onChange={(e) => setProfileForm((f) => ({ ...f, statusMessage: e.target.value }))}
            />
          </div>
          <Button onClick={() => updateProfile()} disabled={isUpdatingProfile} style={{ width: '100%' }}>
            {isUpdatingProfile ? '저장 중...' : '저장'}
          </Button>
          <Button
            variant="outline"
            onClick={() => { setProfileDialogOpen(false); handleLogout() }}
            style={{ width: '100%', marginTop: '0.5rem', color: '#e11d48', borderColor: '#e11d48' }}
          >
            로그아웃
          </Button>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
