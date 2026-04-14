import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/auth/login', '/auth/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isLanding = pathname === '/'
  const isAuthPage = PUBLIC_PATHS.some((path) => pathname.startsWith(path))
  const isPublic = isLanding || isAuthPage

  const authStorage = request.cookies.get('auth-storage')?.value
  let isAuthenticated = false

  if (authStorage) {
    try {
      const parsed = JSON.parse(decodeURIComponent(authStorage)) as {
        state?: { accessToken?: string }
      }
      isAuthenticated = Boolean(parsed?.state?.accessToken)
    } catch {
      isAuthenticated = false
    }
  }

  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/workspace', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)',
  ],
}