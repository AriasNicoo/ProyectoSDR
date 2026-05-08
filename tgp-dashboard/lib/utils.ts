import { format, isToday, isTomorrow, nextMonday, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Reunion, FiltroFecha } from './types'

/**
 * Devuelve el rango de fechas [inicio, fin] para un filtro dado.
 * Se usa para filtrar reuniones en Supabase.
 */
export function getRangoFecha(filtro: FiltroFecha): { desde: string; hasta: string } | null {
  const hoy = new Date()

  switch (filtro) {
    case 'hoy': {
      return {
        desde: startOfDay(hoy).toISOString(),
        hasta: endOfDay(hoy).toISOString(),
      }
    }
    case 'manana': {
      const manana = new Date(hoy)
      manana.setDate(hoy.getDate() + 1)
      return {
        desde: startOfDay(manana).toISOString(),
        hasta: endOfDay(manana).toISOString(),
      }
    }
    case 'lunes': {
      // Próximo lunes (o el lunes actual si hoy es lunes)
      const lunes = hoy.getDay() === 1 ? hoy : nextMonday(hoy)
      return {
        desde: startOfDay(lunes).toISOString(),
        hasta: endOfDay(lunes).toISOString(),
      }
    }
    case 'todos':
    default:
      return null
  }
}

/**
 * Formatea una fecha de reunión para mostrar en el dashboard.
 */
export function formatearFechaReunion(fechaISO: string): string {
  const fecha = new Date(fechaISO)
  if (isToday(fecha)) return `Hoy, ${format(fecha, 'HH:mm')}`
  if (isTomorrow(fecha)) return `Mañana, ${format(fecha, 'HH:mm')}`
  return format(fecha, "EEEE d 'de' MMMM", { locale: es })
}

/**
 * Construye el mensaje de WhatsApp según el tipo de seguimiento.
 */
export function buildWhatsAppMessage(
  tipo: 'post_llamada' | '24h' | '1h',
  nombre: string,
  fechaReunion: string
): string {
  const fecha = formatearFechaReunion(fechaReunion)

  switch (tipo) {
    case 'post_llamada':
      return (
        `Hola ${nombre}! 👋 Gracias por tu tiempo hoy.\n\n` +
        `Me da mucho gusto haber conversado contigo. ` +
        `Quedamos en reunirnos el ${fecha}. Cualquier duda estoy disponible. ¡Hasta entonces! 🚀`
      )
    case '24h':
      return (
        `Hola ${nombre}! ⏰ Solo quería recordarte que nuestra reunión es mañana.\n\n` +
        `Tenemos agendada para el ${fecha}. ¿Todo bien por tu parte? ¡Nos vemos pronto!`
      )
    case '1h':
      return (
        `Hola ${nombre}! 🔔 Nuestra reunión es en 1 hora.\n\n` +
        `Hora: ${fecha}. ¡Aquí estaré listo! Cualquier cambio, avísame.`
      )
  }
}

/**
 * Construye la URL de wa.me para abrir WhatsApp directamente.
 */
export function buildWhatsAppURL(telefono: string, mensaje: string): string {
  // Limpia el teléfono: solo dígitos y opcional '+'
  const telefonoLimpio = telefono.replace(/[^\d+]/g, '')
  return `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`
}

/**
 * Agrupa las reuniones por fecha para presentación.
 */
export function agruparPorFecha(reuniones: Reunion[]): Record<string, Reunion[]> {
  return reuniones.reduce<Record<string, Reunion[]>>((acc, reunion) => {
    const fecha = reunion.fecha_reunion.slice(0, 10) // 'YYYY-MM-DD'
    if (!acc[fecha]) acc[fecha] = []
    acc[fecha].push(reunion)
    return acc
  }, {})
}
