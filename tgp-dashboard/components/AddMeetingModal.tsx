'use client'

import { useState } from 'react'

interface AddMeetingModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<void>
}

export function AddMeetingModal({ open, onClose, onSubmit }: AddMeetingModalProps) {
  const [nombre, setNombre] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('10:00')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !fecha) return

    setSubmitting(true)
    try {
      await onSubmit({
        nombre_prospecto: nombre.trim(),
        empresa: empresa.trim() || null,
        telefono: telefono.trim() || null,
        fecha_reunion: fecha,
        hora_reunion: hora + ':00',
        estado: 'Pendiente'
      })
      onClose()
    } catch {
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Manual (Usa Slack mejor)</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input type="text" className="form-input" value={nombre} onChange={e => setNombre(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Empresa</label>
            <input type="text" className="form-input" value={empresa} onChange={e => setEmpresa(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono (WhatsApp)</label>
            <input type="tel" className="form-input" value={telefono} onChange={e => setTelefono(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input type="date" className="form-input" value={fecha} onChange={e => setFecha(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Hora *</label>
              <input type="time" className="form-input" value={hora} onChange={e => setHora(e.target.value)} required />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Guardando...' : 'Agregar Reunión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
