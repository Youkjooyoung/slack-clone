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

const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, '이메일을 입력해주세요.')
      .email('올바른 이메일 형식이 아닙니다.'),
    username: z
      .string()
      .min(1, '이름을 입력해주세요.')
      .max(100, '이름은 100자 이하여야 합니다.'),
    password: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 합니다.'),
    confirmPassword: z
      .string()
      .min(1, '비밀번호 확인을 입력해주세요.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
  })

type RegisterFormValues = z.infer<typeof registerSchema>

export function RegisterForm() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', username: '', password: '', confirmPassword: '' },
  })

  const { mutate: register, isPending } = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      authApi.signUp({
        email: values.email,
        username: values.username,
        password: values.password,
      }),
    onSuccess: async (res, variables) => {
      const { accessToken, refreshToken } = res.data.data
      setAuth({ id: '', email: variables.email, username: variables.username }, accessToken, refreshToken)
      try {
        const meRes = await userApi.getMe()
        const me = meRes.data.data
        setAuth({ id: me.id, email: me.email, username: me.username, avatarUrl: me.avatarUrl }, accessToken, refreshToken)
      } catch { /* 실패해도 계속 진행 */ }
      router.push('/workspace')
    },
    onError: (error: AxiosError<ApiResponse<null>>) => {
      setServerError(
        error.response?.data?.message ?? '회원가입 중 오류가 발생했습니다.'
      )
    },
  })

  function onSubmit(values: RegisterFormValues) {
    setServerError(null)
    register(values)
  }

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>💬</div>
            <span className={styles.logoText}>SlackClone</span>
          </div>
          <CardTitle className={styles.title}>회원가입</CardTitle>
          <CardDescription className={styles.description}>
            새 계정을 만들어 시작하세요
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
                name="username"
                render={({ field }) => (
                  <FormItem className={styles.field}>
                    <FormLabel>이름</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="홍길동"
                        autoComplete="name"
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
                        placeholder="8자 이상 입력하세요"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className={styles.errorMessage} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem className={styles.field}>
                    <FormLabel>비밀번호 확인</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="비밀번호를 다시 입력하세요"
                        autoComplete="new-password"
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
                {isPending ? '가입 중...' : '회원가입'}
              </Button>
            </form>
          </Form>

          <p className={styles.footer}>
            이미 계정이 있으신가요?{' '}
            <Link href="/auth/login" className={styles.footerLink}>
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
