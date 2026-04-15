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

import { authApi, userApi, type ApiResponse } from '@/lib/api'
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
      setAuth({ id: '', email: form.getValues('email'), username: '' }, accessToken, refreshToken)
      try {
        const meRes = await userApi.getMe()
        const me = meRes.data.data
        setAuth({ id: me.id, email: me.email, username: me.username, avatarUrl: me.avatarUrl ?? undefined }, accessToken, refreshToken)
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
      <div className={styles.formWrapper}>
        <Card className={styles.card}>
          <CardHeader className={styles.header}>
            <div className={styles.logo}>
              <div className={styles.logoIcon}>T</div>
              <span className={styles.logoText}>투톡</span>
            </div>
            <CardTitle className={styles.title}>투톡 로그인</CardTitle>
            <CardDescription className={styles.description}>
              워크스페이스에 로그인하세요
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
                      <FormLabel>이메일 주소</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@example.com"
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

            <div className={styles.divider}>
              <span className={styles.dividerText}>또는 다음으로 로그인하세요</span>
            </div>

            <div className={styles.socialButtons}>
              <button type="button" className={`${styles.socialBtn} ${styles.googleBtn}`}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
                  <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
                  <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
                  <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="#EA4335"/>
                </svg>
                <span>Google로 계속하기</span>
              </button>
              <button type="button" className={`${styles.socialBtn} ${styles.kakaoBtn}`}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3C5.589 3 2 5.858 2 9.362c0 2.27 1.5 4.27 3.77 5.41-.16.58-.62 2.27-.71 2.64-.11.44.16.44.33.32.14-.08 2.14-1.44 2.92-1.96.58.08 1.18.12 1.79.12 4.41 0 7.99-2.86 7.99-6.36S14.41 3 10 3z" fill="#000000"/>
                </svg>
                <span>카카오로 계속하기</span>
              </button>
            </div>

            <p className={styles.footer}>
              계속 진행하면 투톡의{' '}
              <a href="#" className={styles.footerInlineLink}>서비스 약관</a> 및{' '}
              <a href="#" className={styles.footerInlineLink}>개인정보 처리방침</a>에
              동의하는 것으로 간주됩니다.
            </p>
          </CardContent>
        </Card>

        <p className={styles.bottomSwitch}>
          투톡을 처음 사용하시나요?
          <Link href="/auth/register" className={styles.bottomSwitchLink}>
            새 계정 만들기
          </Link>
        </p>
      </div>
    </div>
  )
}
