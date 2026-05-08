import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  // 1. Obtener el cuerpo de la petición como JSON
  const body = await req.json()
  
  // 4. Log para depurar en Vercel
  console.log("Cuerpo recibido:", body)

  // 2. Challenge Handler: Para verificación de Slack (sin seguridad temporalmente)
  if (body.type === 'url_verification') {
    return new NextResponse(body.challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // 3. Procesar Evento de Mensaje
  if (body.type === 'event_callback') {
    const event = body.event

    if (
      event.type === 'message' &&
      !event.bot_id &&
      event.text &&
      event.text.includes('SDR: Nicolas Arias')
    ) {
      const texto = event.text

      // --- Lógica del Parser (Regex) ---
      const nombreMatch = texto.match(/Nombre:\s*(.+)/i)
      const telMatch = texto.match(/Tel[eé]fono:\s*(.+)/i)
      const fechaMatch = texto.match(/Fecha:\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i)
      const horaMatch = texto.match(/Hora:\s*(\d{1,2}:\d{2})/i)
      const meetMatch = texto.match(/(https?:\/\/(?:meet\.google\.com|zoom\.us)[^\s]+)/i)

      const nombre = nombreMatch ? nombreMatch[1].trim() : 'Prospecto Sin Nombre'
      let telefono = telMatch ? telMatch[1].trim() : ''
      let fecha = fechaMatch ? fechaMatch[1] : ''
      const hora = horaMatch ? horaMatch[1] : '10:00'
      const linkMeet = meetMatch ? meetMatch[1] : ''

      // Limpieza de teléfono y formato Chileno (569)
      telefono = telefono.replace(/\D/g, '') // Deja solo números
      if (telefono.length === 8) {
        telefono = '569' + telefono
      } else if (telefono.length === 9 && telefono.startsWith('9')) {
        telefono = '56' + telefono
      } else if (telefono.length === 11 && telefono.startsWith('569')) {
        // Ya está bien
      } else if (!telefono.startsWith('56')) {
        telefono = '56' + telefono
      }

      // Limpieza de Fecha
      if (fecha.includes('/')) {
        const [dia, mes, anio] = fecha.split('/')
        fecha = `${anio}-${mes}-${dia}`
      } else if (!fecha) {
        fecha = new Date().toISOString().split('T')[0] // Hoy por defecto
      }

      // Construir el ISO String requerido por Supabase
      const fechaISO = `${fecha}T${hora.padStart(5, '0')}:00`
      const notasFinales = linkMeet ? `Enlace reunión: ${linkMeet}` : null

      // --- Integración con Supabase ---
      const { error } = await supabase.from('reuniones').insert([{
        nombre_prospecto: nombre,
        telefono: telefono,
        fecha_reunion: fechaISO,
        hora_reunion: hora,
        notas: notasFinales,
        estado_post_llamada: 'pendiente',
        estado_24h: 'pendiente',
        estado_1h: 'pendiente',
      }])

      if (error) {
        console.error('Error insertando en Supabase:', error)
      } else {
        console.log(`Reunión creada exitosamente vía Slack para: ${nombre}`)
      }
    }
  }

  // Responder 200 OK a Slack
  return NextResponse.json({ ok: true })
}
