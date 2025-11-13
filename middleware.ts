import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { locales, defaultLocale } from './lib/i18n'

// Get the preferred locale, similar to the above or using a library
function getLocale(request: NextRequest) {
  // Check if the request has a locale in the path
  const { pathname } = request.nextUrl
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  console.log('🔍 Middleware Debug - Pathname:', pathname)
  console.log('🔍 Middleware Debug - Pathname has locale:', pathnameHasLocale)

  if (pathnameHasLocale) {
    console.log('🔍 Middleware Debug - Path already has locale, skipping redirect')
    return
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')
  console.log('🔍 Middleware Debug - Accept-Language:', acceptLanguage)

  if (acceptLanguage) {
    const preferredLocale = acceptLanguage.split(',')[0].split('-')[0]
    console.log('🔍 Middleware Debug - Preferred locale from header:', preferredLocale)

    if (locales.includes(preferredLocale as any)) {
      console.log('🔍 Middleware Debug - Using preferred locale from header:', preferredLocale)
      return preferredLocale
    }
  }

  console.log('🔍 Middleware Debug - Using default locale:', defaultLocale)
  return defaultLocale
}

export function middleware(request: NextRequest) {
  // Check if there is any supported locale in the pathname
  const { pathname } = request.nextUrl
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  )

  console.log('🚀 Middleware Debug - Processing request for path:', pathname)
  console.log('🚀 Middleware Debug - Pathname missing locale:', pathnameIsMissingLocale)
  console.log('🚀 Middleware Debug - Available locales:', locales)

  // Redirect if there is no locale
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request)

    console.log('🔄 Middleware Debug - Redirecting to locale:', locale)
    console.log('🔄 Middleware Debug - New URL will be:', `/${locale}${pathname}`)

    // e.g. incoming request is /products
    // The new URL is now /en-US/products
    return NextResponse.redirect(
      new URL(`/${locale}${pathname}`, request.url)
    )
  }

  console.log('✅ Middleware Debug - No redirect needed, path already has locale')
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    '/((?!_next|api|favicon.ico|robots.txt|_next/static|_next/image|.*\\.png$|.*\\.svg$).*)',
  ],
}