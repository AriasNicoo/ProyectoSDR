import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase (usamos las mismas credenciales públicas, o podrías usar SERVICE_ROLE en el futuro)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Verifica que la petición provenga genuinamente de Slack usando el SIGNING_SECRET
 */
function verifySlackSignature(
  slackSignature: string | null,
  slackTimestamp: string | null,
  rawBody: string,
  secret: string
): boolean {
  if (!slackSignature || !slackTimestamp || !secret) return false

  const time = parseInt(slackTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  
  // Previene ataques de replay (5 minutos de tolerancia)
  if (Math.abs(now - time) > 300) return false

  const sigBasestring = `v0:${slackTimestamp}:${rawBody}`
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', secret)
    .update(sigBasestring, 'utf8')
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(slackSignature, 'utf8')
    )
  } catch (err) {
    return false
  }
}

export async function POST(req: Request) {
  // 1. Obtener el texto crudo para la validación de la firma
  const rawBody = await req.text()
  
  // Extraer headers de Slack
  const slackSignature = req.headers.get('x-slack-signature')
  const slackTimestamp = req.headers.get('x-slack-request-timestamp')
  const signingSecret = process.env.SLACK_SIGNING_SECRET || ''

  // 2. Seguridad: Validar firma
  if (!verifySlackSignature(slackSignature, slackTimestamp, rawBody, signingSecret)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)

  // 3. Challenge Handler: Para cuando configuremos la URL en Slack por primera vez
  if (body.type === 'url_verification') {
    return new NextResponse(body.challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // 4. Procesar Evento de Mensaje
  if (body.type === 'event_callback') {
    const event = body.event

    // Solo procesamos mensajes, que no sean de bots, y que contengan el trigger exacto
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
        // Ya está bien, no hacemos nada
      } else if (!telefono.startsWith('56')) {
        // Fallback genérico si alguien pone algo raro, asume 569 si no tiene código de país
        telefono = '56' + telefono
      }

      // Limpieza de Fecha (convertir DD/MM/YYYY a YYYY-MM-DD si es necesario)
      if (fecha.includes('/')) {
        const [dia, mes, anio] = fecha.split('/')
        fecha = `${anio}-${mes}-${dia}`
      } else if (!fecha) {
        fecha = new Date().toISOString().split('T')[0] // Hoy por defecto
      }

      // Construir el ISO String requerido por Supabase: "YYYY-MM-DDTHH:mm:00"
      const fechaISO = `${fecha}T${hora.padStart(5, '0')}:00`

      // Guardaremos el enlace del meet en las notas si existe
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

  // Slack requiere un 200 OK rápido para no reintentar enviar el evento
  return NextResponse.json({ ok: true })
}
