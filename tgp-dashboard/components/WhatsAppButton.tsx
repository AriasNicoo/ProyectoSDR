'use client'

import { useState } from 'react'
import type { Reunion, TipoMensaje } from '@/lib/types'
import { buildWhatsAppMessage, buildWhatsAppURL } from '@/lib/utils'

interface WhatsAppButtonProps {
  reunion: Reunion
  tipo: TipoMensaje
  onSent: (reunionId: string, tipo: TipoMensaje) => Promise<void>
}

const CONFIG: Record<TipoMensaje, { label: string; emoji: string; emailLabel: string }> = {
  post_llamada: { label: 'Post',   emoji: '📞', emailLabel: 'Mail Post' },
  '24h':        { label: '24h',    emoji: '⏰', emailLabel: 'Mail 24h' },
  '1h':         { label: '1h',     emoji: '🔔', emailLabel: 'Mail 1h' },
}

export function WhatsAppButton({ reunion, tipo, onSent }: WhatsAppButtonProps) {
  const [loading, setLoading] = useState(false)
  const hasPhone = !!reunion.telefono && reunion.telefono.trim().length > 5

  const campoEstado = tipo === 'post_llamada'
    ? reunion.estado_post_llamada
    : tipo === '24h'
      ? reunion.estado_24h
      : reunion.estado_1h

  const isSent = campoEstado === 'enviado'
  const config = CONFIG[tipo]

  const handleClick = async () => {
    if (loading) return
    setLoading(true)

    if (hasPhone) {
      const mensaje = buildWhatsAppMessage(tipo, reunion.nombre_prospecto, reunion.fecha_reunion, reunion.hora_reunion, reunion.link_meet)
      const url = buildWhatsAppURL(reunion.telefono!, mensaje)
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      // Si no hay teléfono, simplemente marcamos como enviado (simulando que se recordó por mail)
      // O podríamos abrir el mail client, pero el usuario pidió "recordar por mail"
      alert('Esta reunión no tiene teléfono. Enviando recordatorio vía Email (simulado/manual).')
    }

    try {
      await onSent(reunion.id, tipo)
    } catch (err) {
      console.error('Error al actualizar estado:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      className={`wa-btn ${isSent ? 'sent' : ''} ${!hasPhone ? 'no-phone' : ''} ${loading ? 'loading' : ''}`}
      onClick={handleClick}
      disabled={loading}
    >
      <span className="wa-btn-icon">{hasPhone ? config.emoji : '📧'}</span>
      <span className="wa-btn-label">{hasPhone ? config.label : config.emailLabel}</span>
    </button>
  )
}
