// Tipos principales del sistema de seguimiento TGP
export type EstadoMensaje = 'pendiente' | 'enviado' | 'no_aplica'

export interface Reunion {
  id: string
  created_at: string
  
  // Metadatos
  sdr_name: string | null
  titulo_reunion: string | null
  
  // Prospecto
  empresa: string | null
  nombre_prospecto: string
  correos_contacto: string | null
  cargo: string | null
  telefono: string | null
  
  // Tiempo
  fecha_reunion: string             // "YYYY-MM-DD"
  hora_reunion: string              // "HH:mm:ss"
  
  // Origen
  email_origen: string | null
  agendado_para: string | null
  canal: string | null
  notas: string | null        // Contexto
  link_meet: string | null    // URL de Google Meet
  
  // Estado de los 3 mensajes de seguimiento
  estado_post_llamada: EstadoMensaje
  estado_24h: EstadoMensaje
  estado_1h: EstadoMensaje
  
  estados_actualizados_en?: string | null
  ultima_interaccion?: string | null
}

export type TipoMensaje = 'post_llamada' | '24h' | '1h'

export interface ActualizarEstadoPayload {
  reunionId: string
  tipoMensaje: TipoMensaje
  estado: EstadoMensaje
}

// Filtros de vista - Ahora por día de la semana
export type FiltroFecha = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'todos'
