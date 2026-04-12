'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'

import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Button } from '@/components/ui/button'

import { workspaceApi, type ApiResponse } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { Workspace } from '@/types'
import styles from './workspace.module.css'

const createSchema = z.object({
  name: z.string().min(1, '워크스페이스 이름은 필수입니다.').max(100),
  slug: z
    .string()
    .min(1, '슬러그는 필수입니다.')
    .max(100)
    .regex(/^[a-z0-9-]+$/, '소문자, 숫자, 하이픈만 사용할 수 있습니다.'),
  description: z.string().optional(),
})

type CreateFormValues = z.infer<typeof createSchema>

const ROLE_LABEL: Record<string, string> = {
  OWNER: '소유자',
  ADMIN: '관리자',
  MEMBER: '멤버',
  GUEST: '게스트',
}

const WS_GRADIENTS = [
  'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
  'linear-gradient(135deg, #1164a3 0%, #0ea5e9 100%)',
  'linear-gradient(135deg, #007a5a 0%, #10b981 100%)',
  'linear-gradient(135deg, #c7224b 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  'linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%)',
]

export default function WorkspaceListPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { clearAuth, user, accessToken } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!accessToken) {
      router.replace('/auth/login')
    }
  }, [accessToken, router])

  function handleLogout() {
    clearAuth()
    queryClient.clear()
    router.push('/auth/login')
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getMyWorkspaces().then((r) => r.data.data),
    staleTime: 60_000,
    retry: 1,
  })

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', slug: '', description: '' },
  })

  const { mutate: createWorkspace, isPending } = useMutation({
    mutationFn: (values: CreateFormValues) =>
      workspaceApi.create({
        name: values.name,
        slug: values.slug,
        description: values.description,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setOpen(false)
      form.reset()
      router.push(`/workspace/${res.data.data.id}`)
    },
    onError: (err: AxiosError<ApiResponse<null>>) => {
      setServerError(err.response?.data?.message ?? '워크스페이스 생성 중 오류가 발생했습니다.')
    },
  })

  function onSubmit(values: CreateFormValues) {
    setServerError(null)
    createWorkspace(values)
  }

  const workspaces: Workspace[] = data ?? []
  const isNetworkError = isError && (error as AxiosError)?.code === 'ERR_NETWORK'

  return (
    <div className={styles.page}>
      {/* 브랜드 */}
      <div className={styles.brand}>
        <div className={styles.brandIcon}>💬</div>
        <span className={styles.brandName}>SlackClone</span>
      </div>

      {/* 메인 카드 */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.cardTitle}>워크스페이스 선택</p>
          <p className={styles.cardSub}>
            {user?.email ?? '내 계정'} · 참여 중인 워크스페이스
          </p>
        </div>

        {/* 로딩 */}
        {isLoading && (
          <div className={styles.loadingWrap}>
            <div className={styles.loadingSpinner} />
            <span className={styles.loadingText}>워크스페이스 불러오는 중...</span>
          </div>
        )}

        {/* 에러 */}
        {isError && (
          <div className={styles.errorWrap}>
            <div className={styles.errorIcon}>{isNetworkError ? '🔌' : '⚠️'}</div>
            <p className={styles.errorTitle}>
              {isNetworkError ? '서버에 연결할 수 없습니다' : '데이터를 불러오지 못했습니다'}
            </p>
            <p className={styles.errorDesc}>
              {isNetworkError
                ? '백엔드 서버가 실행되지 않고 있습니다.\nDocker Desktop을 시작한 후 아래 명령어를 실행하세요.'
                : '잠시 후 다시 시도해주세요.'}
            </p>
            {isNetworkError && (
              <code className={styles.errorCode}>
                {`cd slack-clone\ndocker compose up -d postgres redis\ncd backend && ./gradlew bootRun`}
              </code>
            )}
            <button className={styles.retryBtn} onClick={() => refetch()}>
              다시 시도
            </button>
          </div>
        )}

        {/* 워크스페이스 목록 */}
        {!isLoading && !isError && (
          <>
            {workspaces.length === 0 ? (
              <div className={styles.emptyWrap}>
                <div className={styles.emptyIcon}>🏢</div>
                <p className={styles.emptyTitle}>아직 워크스페이스가 없습니다</p>
                <p className={styles.emptyDesc}>
                  새 워크스페이스를 만들거나 팀원의 초대를 기다리세요.
                </p>
              </div>
            ) : (
              <div className={styles.wsList}>
                {workspaces.map((ws, i) => (
                  <button
                    key={ws.id}
                    className={styles.wsItem}
                    onClick={() => router.push(`/workspace/${ws.id}`)}
                  >
                    <div
                      className={styles.wsAvatar}
                      style={{ background: WS_GRADIENTS[i % WS_GRADIENTS.length] }}
                    >
                      {ws.iconUrl
                        ? <img src={ws.iconUrl} alt={ws.name} width={36} height={36} style={{ borderRadius: 8 }} />
                        : ws.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.wsInfo}>
                      <p className={styles.wsName}>{ws.name}</p>
                      <span className={styles.wsRole}>
                        {ROLE_LABEL[ws.myRole] ?? ws.myRole}
                      </span>
                    </div>
                    <span className={styles.wsArrow}>›</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* 푸터 */}
        <div className={styles.cardFooter}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className={styles.createBtn}>
                <span>+</span> 새 워크스페이스 만들기
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>워크스페이스 만들기</DialogTitle>
                <DialogDescription>새 워크스페이스의 이름과 슬러그를 입력하세요.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className={styles.modal}>
                  {serverError && <p className={styles.serverError}>{serverError}</p>}

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className={styles.field}>
                        <FormLabel>이름</FormLabel>
                        <FormControl>
                          <Input placeholder="우리 팀" {...field} />
                        </FormControl>
                        <FormMessage className={styles.errorMsg} />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem className={styles.field}>
                        <FormLabel>슬러그 (URL)</FormLabel>
                        <FormControl>
                          <Input placeholder="our-team" {...field} />
                        </FormControl>
                        <FormMessage className={styles.errorMsg} />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className={styles.field}>
                        <FormLabel>설명 (선택)</FormLabel>
                        <FormControl>
                          <Input placeholder="팀 설명을 입력하세요" {...field} />
                        </FormControl>
                        <FormMessage className={styles.errorMsg} />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isPending}>
                    {isPending ? '생성 중...' : '만들기'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <button className={styles.logoutBtn} onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
