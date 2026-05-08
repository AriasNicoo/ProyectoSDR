'use client'

import { useState } from 'react'
import type { Reunion, TipoMensaje } from '@/lib/types'
import { buildWhatsAppMessage, buildWhatsAppURL, formatearFechaReunion } from '@/lib/utils'

interface WhatsAppButtonProps {
  reunion: Reunion
  tipo: TipoMensaje
  onSent: (reunionId: string, tipo: TipoMensaje) => Promise<void>
}

const CONFIG: Record<TipoMensaje, { label: string; emoji: string; title: string }> = {
  post_llamada: { label: 'Post-llamada', emoji: '📞', title: 'Mensaje post-llamada' },
  '24h':        { label: '24h antes',    emoji: '⏰', title: 'Recordatorio 24 horas' },
  '1h':         { label: '1h antes',     emoji: '🔔', title: 'Recordatorio 1 hora' },
}

export function WhatsAppButton({ reunion, tipo, onSent }: WhatsAppButtonProps) {
  const [loading, setLoading] = useState(false)

  const campoEstado = tipo === 'post_llamada'
    ? reunion.estado_post_llamada
    : tipo === '24h'
      ? reunion.estado_24h
      : reunion.estado_1h

  const isSent = campoEstado === 'enviado'
  const config = CONFIG[tipo]

  /**
   * ─────────────────────────────────────────────────────────────
   * SOLUCIÓN AL PROBLEMA DE FOCO:
   *
   * El truco clave es llamar window.open() PRIMERO (sincrónico,
   * dentro del event handler → el navegador lo permite sin bloquear)
   * y DESPUÉS actualizar Supabase de forma asíncrona.
   *
   * Si hiciéramos: await supabase.update() → window.open()
   * el await rompe la cadena sincrónica del evento y muchos
   * navegadores bloquean el popup como no-iniciado-por-usuario.
   *
   * Con este orden:
   * 1. window.open() se ejecuta sincrónicamente → abre WhatsApp Web
   * 2. La actualización de Supabase ocurre en background
   * 3. El estado local ya se actualiza optimistamente en el hook
   * ─────────────────────────────────────────────────────────────
   */
  const handleClick = async () => {
    if (loading) return
    setLoading(true)

    const mensaje = buildWhatsAppMessage(tipo, reunion.nombre_prospecto, reunion.fecha_reunion)
    const url = buildWhatsAppURL(reunion.telefono, mensaje)

    // 1. Abrir WhatsApp PRIMERO (sincrónico — evita bloqueo de popup)
    window.open(url, '_blank', 'noopener,noreferrer')

    // 2. Actualizar Supabase en background (ya no afecta el popup)
    try {
      await onSent(reunion.id, tipo)
    } catch (err) {
      console.error('Error al marcar mensaje como enviado:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      id={`wa-btn-${reunion.id}-${tipo}`}
      className={`wa-btn ${isSent ? 'sent' : ''} ${loading ? 'loading' : ''}`}
      onClick={handleClick}
      disabled={loading}
      title={isSent ? `${config.title} — Ya enviado ✓` : config.title}
      aria-label={`${config.label} para ${reunion.nombre_prospecto}${isSent ? ' (enviado)' : ''}`}
    >
      <span className="wa-btn-icon">{config.emoji}</span>
      <span className="wa-btn-label">{config.label}</span>
    </button>
  )
}
