// Tipos principales del sistema de seguimiento TGP
export type EstadoMensaje = 'pendiente' | 'enviado' | 'no_aplica'

export interface Reunion {
  id: string
  nombre_prospecto: string
  telefono: string
  fecha_reunion: string       // ISO date string
  hora_reunion: string        // "HH:mm"
  notas: string | null
  // Estado de los 3 mensajes de seguimiento
  estado_post_llamada: EstadoMensaje
  estado_24h: EstadoMensaje
  estado_1h: EstadoMensaje
  // Timestamp de última actualización de estados
  estados_actualizados_en: string | null
  // Columna preparada para webhook de respuesta futura
  ultima_interaccion: string | null
  // Metadatos
  created_at: string
  updated_at: string
}

export type TipoMensaje = 'post_llamada' | '24h' | '1h'

export interface ActualizarEstadoPayload {
  reunionId: string
  tipoMensaje: TipoMensaje
  estado: EstadoMensaje
}

// Filtros de vista
export type FiltroFecha = 'hoy' | 'manana' | 'lunes' | 'todos'
