import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      const email = data.user.email
      
      // 1. Validar el dominio corporativo
      if (!email || !email.endsWith('@thegrowth.pro')) {
        await supabase.auth.signOut()
        // Redirigir a login con error de dominio
        return NextResponse.redirect(`${origin}/login?error=dominio_no_permitido`)
      }

      // 2. Verificar si el usuario ya tiene registro en la tabla perfiles
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('nombre_sdr')
        .eq('id', data.user.id)
        .single()

      // 3. Si no tiene perfil, forzar el registro del nombre
      if (!perfil || !perfil.nombre_sdr) {
        return NextResponse.redirect(`${origin}/completar-perfil`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // En caso de error en el intercambio de código, redirigir a login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
