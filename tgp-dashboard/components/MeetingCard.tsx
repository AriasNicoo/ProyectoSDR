'use client'

import type { Reunion, TipoMensaje } from '@/lib/types'
import { formatearFechaReunion } from '@/lib/utils'
import { WhatsAppButton } from './WhatsAppButton'

interface MeetingCardProps {
  reunion: Reunion
  onSent: (reunionId: string, tipo: TipoMensaje) => Promise<void>
  onDelete: (reunionId: string) => void
}

const TIPOS_MENSAJE: TipoMensaje[] = ['post_llamada', '24h', '1h']

function getEstadoClass(estado: string): string {
  if (estado === 'enviado') return 'sent'
  if (estado === 'pendiente') return 'pending'
  return ''
}

export function MeetingCard({ reunion, onSent, onDelete }: MeetingCardProps) {
  const mensajesEnviados = [
    reunion.estado_post_llamada,
    reunion.estado_24h,
    reunion.estado_1h,
  ].filter(e => e === 'enviado').length

  return (
    <article
      className="meeting-card"
      aria-label={`Reunión con ${reunion.nombre_prospecto}`}
    >
      <div className="meeting-card-left">
        {/* Nombre + progress dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="meeting-name">{reunion.nombre_prospecto}</span>

          {/* Mini progress indicator (3 segmentos) */}
          <div className="progress-track" title={`${mensajesEnviados}/3 mensajes enviados`}>
            <div className={`progress-segment ${reunion.estado_post_llamada === 'enviado' ? 'sent' : ''}`} />
            <div className={`progress-segment ${reunion.estado_24h === 'enviado' ? 'sent' : ''}`} />
            <div className={`progress-segment ${reunion.estado_1h === 'enviado' ? 'sent' : ''}`} />
          </div>

          {/* Dot indicators individuales */}
          <div className="msg-status-row">
            <div
              className={`msg-dot ${getEstadoClass(reunion.estado_post_llamada)}`}
              title={`Post-llamada: ${reunion.estado_post_llamada}`}
            />
            <div
              className={`msg-dot ${getEstadoClass(reunion.estado_24h)}`}
              title={`24h: ${reunion.estado_24h}`}
            />
            <div
              className={`msg-dot ${getEstadoClass(reunion.estado_1h)}`}
              title={`1h: ${reunion.estado_1h}`}
            />
          </div>
        </div>

        {/* Meta info */}
        <div className="meeting-meta">
          <span className="meeting-time" title="Fecha y hora de la reunión">
            🕐 {formatearFechaReunion(reunion.fecha_reunion)}
            {reunion.hora_reunion && ` · ${reunion.hora_reunion}`}
          </span>
          <span className="meeting-phone" title="Teléfono">
            📱 {reunion.telefono}
          </span>
          {reunion.ultima_interaccion && (
            <span className="last-interaction" title="Última interacción del prospecto">
              💬 Respondió {new Date(reunion.ultima_interaccion).toLocaleString('es')}
            </span>
          )}
        </div>

        {/* Notas */}
        {reunion.notas && (
          <p className="meeting-notes" title={reunion.notas}>
            {reunion.notas}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="meeting-card-right">
        {/* WhatsApp buttons */}
        <div className="wa-btn-group" role="group" aria-label="Mensajes de WhatsApp">
          {TIPOS_MENSAJE.map(tipo => (
            <WhatsAppButton
              key={tipo}
              reunion={reunion}
              tipo={tipo}
              onSent={onSent}
            />
          ))}
        </div>

        {/* Delete */}
        <div className="meeting-actions">
          <button
            id={`btn-delete-${reunion.id}`}
            className="btn-icon danger"
            onClick={() => onDelete(reunion.id)}
            title="Eliminar reunión"
            aria-label={`Eliminar reunión con ${reunion.nombre_prospecto}`}
          >
            🗑
          </button>
        </div>
      </div>
    </article>
  )
}
