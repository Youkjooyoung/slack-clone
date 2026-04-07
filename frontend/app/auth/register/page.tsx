import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = {
  title: '회원가입 | SlackClone',
}

export default function RegisterPage() {
  return <RegisterForm />
}
