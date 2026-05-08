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

export function MeetingCard({ reunion, onSent, onDelete }: MeetingCardProps) {
  const hasPhone = !!reunion.telefono && reunion.telefono.length > 5

  // Extraer el cliente de las notas si viene con el formato [Cliente: Nombre | ...]
  let clienteName = 'N/A'
  if (reunion.notas) {
    const match = reunion.notas.match(/Cliente:\s*([^|\]]+)/i)
    if (match) {
      clienteName = match[1].trim()
    }
  }

  return (
    <article className="meeting-card" aria-label={`Reunión con ${reunion.nombre_prospecto}`}>
      {/* Header: Nombre, Empresa y Hora */}
      <div className="card-header">
        <div className="card-title-group">
          <span className="meeting-empresa">{reunion.empresa || 'Sin Empresa'}</span>
          <span className="meeting-name">{reunion.nombre_prospecto || 'Sin Nombre'}</span>
        </div>
        <div className="meeting-time-pill">
          {reunion.hora_reunion ? reunion.hora_reunion.substring(0, 5) : '--:--'}
        </div>
      </div>

      {/* Detalles Secundarios */}
      <div className="card-details">
        <div className="detail-item">
          <span className="detail-label">Cliente</span>
          <span className="detail-value" style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{clienteName}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">SDR</span>
          <span className="detail-value">{reunion.sdr_name || 'N/A'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Cargo</span>
          <span className="detail-value">{reunion.cargo || 'N/A'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Teléfono</span>
          <span className="detail-value">{reunion.telefono || 'N/A'}</span>
        </div>
        <div className="detail-item" style={{ gridColumn: 'span 2' }}>
          <span className="detail-label">Fecha de la Reunión</span>
          <span className="detail-value" style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>
            📅 {formatearFechaReunion(reunion.fecha_reunion, reunion.hora_reunion)}
          </span>
        </div>
        <div className="detail-item" style={{ gridColumn: 'span 2' }}>
          <span className="detail-label">Link de Reunión</span>
          {reunion.link_meet ? (
            <a href={reunion.link_meet} target="_blank" rel="noopener noreferrer" className="detail-value" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>
              📹 Entrar a Meet
            </a>
          ) : (
            <span className="detail-value">No disponible</span>
          )}
        </div>
      </div>

      {/* Acciones de Seguimiento (WhatsApp o Email Alert) */}
      <div className="wa-actions">
        {TIPOS_MENSAJE.map(tipo => (
          <WhatsAppButton
            key={tipo}
            reunion={reunion}
            tipo={tipo}
            onSent={onSent}
          />
        ))}
      </div>

      {/* Footer: Notas y Borrar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '80%' }}>
          {reunion.notas ? `"${reunion.notas.substring(0, 50)}${reunion.notas.length > 50 ? '...' : ''}"` : 'Sin contexto adicional'}
        </p>
        <button 
          onClick={() => { if(confirm('¿Eliminar esta reunión?')) onDelete(reunion.id) }}
          style={{ background: 'none', border: 'none', color: 'var(--accent-red)', opacity: 0.5, cursor: 'pointer', fontSize: '14px' }}
        >
          🗑️
        </button>
      </div>
    </article>
  )
}
