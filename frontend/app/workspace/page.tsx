'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

import { workspaceApi, type ApiResponse } from '@/lib/api'
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

export default function WorkspaceListPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getMyWorkspaces().then((r) => r.data.data),
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
    onError: (error: AxiosError<ApiResponse<null>>) => {
      setServerError(error.response?.data?.message ?? '워크스페이스 생성 중 오류가 발생했습니다.')
    },
  })

  function onSubmit(values: CreateFormValues) {
    setServerError(null)
    createWorkspace(values)
  }

  const workspaces: Workspace[] = data ?? []

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>워크스페이스</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>새 워크스페이스</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>워크스페이스 만들기</DialogTitle>
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
      </div>

      {isLoading ? (
        <div className={styles.empty}>
          <p>불러오는 중...</p>
        </div>
      ) : workspaces.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>워크스페이스가 없습니다</p>
          <p>새 워크스페이스를 만들거나 초대를 받아보세요.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {workspaces.map((ws) => (
            <Card
              key={ws.id}
              className={styles.workspaceCard}
              onClick={() => router.push(`/workspace/${ws.id}`)}
            >
              <CardContent style={{ paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
                <div className={styles.cardInner}>
                  <div className={styles.icon}>
                    {ws.iconUrl ? (
                      <img src={ws.iconUrl} alt={ws.name} width={32} height={32} />
                    ) : (
                      ws.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className={styles.cardName}>{ws.name}</p>
                    <p className={styles.cardRole}>{ROLE_LABEL[ws.myRole] ?? ws.myRole}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
