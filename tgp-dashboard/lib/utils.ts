import { format, isToday, isTomorrow, startOfWeek, addDays, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Reunion, FiltroFecha } from './types'

/**
 * Devuelve el rango de fechas para filtrar por día de la semana (L-V)
 * Siempre se enfoca en la SEMANA ACTUAL.
 */
export function getRangoFecha(filtro: FiltroFecha, adelantarSemana: boolean = false): { desde: string; hasta: string } | null {
  if (filtro === 'todos') return null

  let hoy = new Date()
  
  // Si es Sábado (6), Domingo (0) o si se solicita adelantar la semana explícitamente
  const diaSemana = hoy.getDay() // 0 = Dom, 1 = Lun, 2 = Mar, 3 = Mie, 4 = Jue, 5 = Vie, 6 = Sab

  const diasOffset: Record<string, number> = {
    lunes: 0,
    martes: 1,
    miercoles: 2,
    jueves: 3,
    viernes: 4
  }

  const offset = diasOffset[filtro as string]
  if (offset === undefined) return null

  // Convertimos diaSemana a formato donde Lunes=0, Domingo=6 para comparación
  const diaSemanaIndex = diaSemana === 0 ? 6 : diaSemana - 1

  // Si es finde, o si forzamos adelantar, o si el día seleccionado YA PASÓ esta semana
  // (ej: hoy es Miércoles=2 y selecciono Lunes=0), adelantamos a la próxima semana.
  let debeAdelantar = adelantarSemana || diaSemana === 6 || diaSemana === 0
  
  if (!debeAdelantar && offset < diaSemanaIndex) {
    debeAdelantar = true
  }

  if (debeAdelantar) {
    const diasParaAdelantar = diaSemana === 5 ? 3 : (diaSemana === 6 ? 2 : (diaSemana === 0 ? 1 : 7))
    hoy = addDays(hoy, diasParaAdelantar)
  }

  const lunesSemanaActual = startOfWeek(hoy, { weekStartsOn: 1 })

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
 * Usa los templates oficiales del equipo SDR de The Growth Pro.
 */
export function buildWhatsAppMessage(
  tipo: 'post_llamada' | '24h' | '1h',
  nombre: string,
  fecha: string,
  hora: string,
  linkMeet?: string | null,
  sdrName?: string | null,
  cliente?: string | null
): string {
  const primerNombre = nombre ? nombre.trim().split(/\s+/)[0] : 'prospecto'
  const horaFormateada = hora ? hora.substring(0, 5) : ''
  const fechaTexto = formatearFechaReunion(fecha, hora)
  const sdr = sdrName ? sdrName.trim().split(/\s+/)[0] : 'tu SDR'
  const clienteNombre = cliente || 'nuestra empresa'
  const linkTexto = linkMeet ? linkMeet : '(link no disponible)'

  switch (tipo) {
    case 'post_llamada':
      return (
        `Hola ${primerNombre}, por acá ${sdr} de ${clienteNombre}. ` +
        `Tal como conversamos por teléfono, la reunión quedó agendada para el día ${fechaTexto}. ` +
        (linkMeet
          ? `Te adjunto el link para que puedas aceptar en tu calendario: ${linkTexto}. `
          : '') +
        `¡Saludos!`
      )

    case '24h':
      return (
        `Hola ${primerNombre}, ¿cómo estás? Te escribo de ${clienteNombre} para recordarte nuestra reunión de mañana a las ${horaFormateada}. ` +
        (linkMeet
          ? `Te dejo el link de acceso a mano para que nos conectemos: ${linkTexto}. `
          : '') +
        `¡Que tengas buen día!`
      )

    case '1h':
      return (
        `Hola ${primerNombre}, ¡buen día! Te recuerdo que en un ratito, a las ${horaFormateada}, tenemos nuestra reunión. ` +
        (linkMeet
          ? `Nos vemos en este link: ${linkTexto}. `
          : '') +
        `¡Nos vemos ahí!`
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
