'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function actualizarPerfilSDR(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  const rawNombre = formData.get('nombre') as string
  const rawApellido = formData.get('apellido') as string

  if (!rawNombre || !rawApellido) {
    return
  }

  // Guardar como lo escribe el usuario capitalizado apropiadamente
  const capitalizar = (str: string) => str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const nombreFinal = `${capitalizar(rawNombre)} ${capitalizar(rawApellido)}`

  // Upsert en la tabla perfiles
  const { error } = await supabase.from('perfiles').upsert({
    id: user.id,
    email: user.email,
    nombre_sdr: nombreFinal,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' })

  if (error) {
    console.error('Error guardando perfil:', error)
    return
  }

  // Redirigir al dashboard una vez listo
  redirect('/')
}
