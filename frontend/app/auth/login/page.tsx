import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: '로그인 | 투톡',
}

export default function LoginPage() {
  return <LoginForm />
}
