'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

import { authApi, userApi, type ApiResponse, type TokenResponse } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import styles from './auth.module.css'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email('올바른 이메일 형식이 아닙니다.'),
  password: z
    .string()
    .min(1, '비밀번호를 입력해주세요.'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const { mutate: login, isPending } = useMutation({
    mutationFn: (values: LoginFormValues) => authApi.login(values),
    onSuccess: async (res) => {
      const { accessToken, refreshToken } = res.data.data
      // 임시로 토큰만 먼저 저장
      setAuth({ id: '', email: form.getValues('email'), username: '' }, accessToken, refreshToken)
      try {
        // 실제 user 정보 조회 후 갱신
        const meRes = await userApi.getMe()
        const me = meRes.data.data
        setAuth({ id: me.id, email: me.email, username: me.username, avatarUrl: me.avatarUrl }, accessToken, refreshToken)
      } catch { /* 실패해도 계속 진행 */ }
      router.push('/workspace')
    },
    onError: (error: AxiosError<ApiResponse<null>>) => {
      setServerError(
        error.response?.data?.message ?? '로그인 중 오류가 발생했습니다.'
      )
    },
  })

  function onSubmit(values: LoginFormValues) {
    setServerError(null)
    login(values)
  }

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>💬</div>
            <span className={styles.logoText}>SlackClone</span>
          </div>
          <CardTitle className={styles.title}>로그인</CardTitle>
          <CardDescription className={styles.description}>
            계정에 로그인하세요
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.content}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
              {serverError && (
                <p className={styles.serverError}>{serverError}</p>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className={styles.field}>
                    <FormLabel>이메일</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="name@company.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className={styles.errorMessage} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className={styles.field}>
                    <FormLabel>비밀번호</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="비밀번호를 입력하세요"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className={styles.errorMessage} />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className={styles.submitButton}
                disabled={isPending}
              >
                {isPending ? '로그인 중...' : '로그인'}
              </Button>
            </form>
          </Form>

          <p className={styles.footer}>
            계정이 없으신가요?{' '}
            <Link href="/auth/register" className={styles.footerLink}>
              회원가입
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
