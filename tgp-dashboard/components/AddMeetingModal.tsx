'use client'

import { useState } from 'react'

interface AddMeetingModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    nombre_prospecto: string
    telefono: string
    fecha_reunion: string
    hora_reunion: string
    notas: string | null
  }) => Promise<void>
}

export function AddMeetingModal({ open, onClose, onSubmit }: AddMeetingModalProps) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('10:00')
  const [notas, setNotas] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !telefono.trim() || !fecha) return

    setSubmitting(true)
    try {
      // Combinamos fecha + hora en un ISO string
      const fechaISO = `${fecha}T${hora}:00`
      await onSubmit({
        nombre_prospecto: nombre.trim(),
        telefono: telefono.trim(),
        fecha_reunion: fechaISO,
        hora_reunion: hora,
        notas: notas.trim() || null,
      })
      // Reset
      setNombre('')
      setTelefono('')
      setFecha('')
      setHora('10:00')
      setNotas('')
      onClose()
    } catch {
      // El error se maneja en el padre con toast
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title" id="modal-title">Nueva Reunión 📅</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="input-nombre" className="form-label">Nombre del Prospecto *</label>
            <input
              id="input-nombre"
              type="text"
              className="form-input"
              placeholder="Ej. Juan Pérez"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="input-telefono" className="form-label">Teléfono WhatsApp *</label>
            <input
              id="input-telefono"
              type="tel"
              className="form-input"
              placeholder="Ej. +52 55 1234 5678"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="input-fecha" className="form-label">Fecha *</label>
              <input
                id="input-fecha"
                type="date"
                className="form-input"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="input-hora" className="form-label">Hora *</label>
              <input
                id="input-hora"
                type="time"
                className="form-input"
                value={hora}
                onChange={e => setHora(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="input-notas" className="form-label">Notas (opcional)</label>
            <input
              id="input-notas"
              type="text"
              className="form-input"
              placeholder="Ej. Interesado en el plan Pro"
              value={notas}
              onChange={e => setNotas(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              id="btn-submit-reunion"
              type="submit"
              className="btn-primary"
              disabled={submitting || !nombre.trim() || !telefono.trim() || !fecha}
            >
              {submitting ? 'Guardando...' : '✓ Agregar Reunión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
