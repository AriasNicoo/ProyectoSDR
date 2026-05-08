import { format, isToday, isTomorrow, startOfWeek, addDays, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Reunion, FiltroFecha } from './types'

/**
 * Devuelve el rango de fechas para filtrar por día de la semana (L-V)
 * Siempre se enfoca en la SEMANA ACTUAL.
 */
export function getRangoFecha(filtro: FiltroFecha): { desde: string; hasta: string } | null {
  if (filtro === 'todos') return null

  let hoy = new Date()
  
  // Si es Sábado (6) o Domingo (0), adelantamos la referencia para mostrar la PRÓXIMA semana
  const diaSemana = hoy.getDay()
  if (diaSemana === 6 || diaSemana === 0) {
    hoy = addDays(hoy, 2)
  }

  const lunesSemanaActual = startOfWeek(hoy, { weekStartsOn: 1 })

  const diasOffset: Record<string, number> = {
    lunes: 0,
    martes: 1,
    miercoles: 2,
    jueves: 3,
    viernes: 4
  }

  const offset = diasOffset[filtro as string]
  if (offset === undefined) return null

  const diaDeseado = addDays(lunesSemanaActual, offset)
  const diaString = format(diaDeseado, 'yyyy-MM-dd')

  return {
    desde: diaString,
    hasta: diaString
  }
}

/**
 * Formatea una fecha de reunión para mostrar en el dashboard.
 */
export function formatearFechaReunion(fecha: string, hora?: string): string {
  // Combinamos fecha (YYYY-MM-DD) y hora (HH:mm:ss) para formateo
  const d = new Date(`${fecha}T${hora || '00:00:00'}`)
  
  if (isToday(d)) return `Hoy, ${format(d, 'HH:mm')}`
  if (isTomorrow(d)) return `Mañana, ${format(d, 'HH:mm')}`
  
  return format(d, "EEEE d 'de' MMMM, HH:mm", { locale: es })
}

/**
 * Construye el mensaje de WhatsApp según el tipo de seguimiento.
 */
export function buildWhatsAppMessage(
  tipo: 'post_llamada' | '24h' | '1h',
  nombre: string,
  fecha: string,
  hora: string
): string {
  const fechaTexto = formatearFechaReunion(fecha, hora)

  switch (tipo) {
    case 'post_llamada':
      return (
        `Hola ${nombre}! 👋 Gracias por tu tiempo hoy.\n\n` +
        `Me da mucho gusto haber conversado contigo. ` +
        `Quedamos en reunirnos el ${fechaTexto}. Cualquier duda estoy disponible. ¡Hasta entonces! 🚀`
      )
    case '24h':
      return (
        `Hola ${nombre}! ⏰ Solo quería recordarte que nuestra reunión es mañana.\n\n` +
        `Tenemos agendada para el ${fechaTexto}. ¿Todo bien por tu parte? ¡Nos vemos pronto!`
      )
    case '1h':
      return (
        `Hola ${nombre}! 🔔 Nuestra reunión es en 1 hora.\n\n` +
        `Hora: ${fechaTexto}. ¡Aquí estaré listo! Cualquier cambio, avísame.`
      )
  }
}

/**
 * Construye la URL de wa.me para abrir WhatsApp directamente.
 */
export function buildWhatsAppURL(telefono: string, mensaje: string): string {
  // Limpia el teléfono de nuevo por seguridad: solo dígitos
  const telefonoLimpio = (telefono || '').replace(/\D/g, '')
  // Usamos api.whatsapp.com que es más estable en desktop y mobile
  return `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`
}

/**
 * Agrupa las reuniones por fecha para presentación.
 */
export function agruparPorFecha(reuniones: Reunion[]): Record<string, Reunion[]> {
  return reuniones.reduce<Record<string, Reunion[]>>((acc, reunion) => {
    const fecha = reunion.fecha_reunion
    if (!acc[fecha]) acc[fecha] = []
    acc[fecha].push(reunion)
    return acc
  }, {})
}
