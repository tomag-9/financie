import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl
  const totpRequired = req.auth?.totpRequired === true
  const totpVerified = req.cookies.get('totp_verified')?.value === '1'

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth')

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isLoggedIn && totpRequired && !totpVerified && !pathname.startsWith('/login')) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('step', 'totp')
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isLoggedIn && pathname === '/login') {
    if (totpRequired && !totpVerified) {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
