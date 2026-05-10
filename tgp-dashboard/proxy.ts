import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  // Actualizar la sesión del usuario
  const { supabaseResponse, user } = await updateSession(request)

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/callback')
  const isWebhook = request.nextUrl.pathname.startsWith('/api/webhook')

  // Permitir acceso libre a webhooks y al callback de autenticación
  if (isWebhook || isAuthCallback) {
    return supabaseResponse
  }

  // Si NO hay usuario logueado y NO está en la página de login, redirigir a login
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si HAY usuario y está en login, enviarlo al dashboard o perfil
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt
     * - sitemap.xml
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
