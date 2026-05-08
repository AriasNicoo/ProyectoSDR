'use client'

import { useState } from 'react'
import { useReuniones } from '@/hooks/useReuniones'
import { useToast } from '@/hooks/useToast'
import { FilterBar } from './FilterBar'
import { MeetingCard } from './MeetingCard'
import { AddMeetingModal } from './AddMeetingModal'
import { ToastContainer } from './ToastContainer'
import type { TipoMensaje } from '@/lib/types'

export function Dashboard() {
  const {
    reuniones,
    loading,
    error,
    filtro,
    setFiltro,
    actualizarEstadoMensaje,
    eliminarReunion,
  } = useReuniones()

  const { toasts, addToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)

  const handleSentMessage = async (reunionId: string, tipo: TipoMensaje) => {
    try {
      await actualizarEstadoMensaje(reunionId, tipo, 'enviado')
      addToast('✅ Registro actualizado', 'success')
    } catch {
      addToast('No se pudo actualizar el estado', 'error')
    }
  }

  const handleDelete = async (reunionId: string) => {
    try {
      await eliminarReunion(reunionId)
      addToast('🗑️ Reunión eliminada', 'success')
    } catch {
      addToast('Error al eliminar la reunión', 'error')
    }
  }

  const handleAddReunion = async (data: any) => {
    // Implementación mínima para manual, aunque el flujo es vía Slack
    addToast('⚠️ Usa el canal de Slack para agregar reuniones con el formato Edenred.', 'error')
    setModalOpen(false)
  }

  const pendienteCount = reuniones.filter(r =>
    r.estado_post_llamada !== 'enviado' ||
    r.estado_24h !== 'enviado' ||
    r.estado_1h !== 'enviado'
  ).length

  return (
    <div className="app-wrapper">
      {/* HEADER NATIVO */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">
            <span className="app-logo-title">SDR TRACKER</span>
          </div>
          {pendienteCount > 0 && (
            <div className="stat-pill">
              {pendienteCount} pendientes
            </div>
          )}
        </div>
      </header>

      {/* TABS DE NAVEGACIÓN (L-V) */}
      <FilterBar
        filtroActivo={filtro}
        onFiltroChange={setFiltro}
        onAgregarReunion={() => setModalOpen(true)}
        reuniones={reuniones}
      />

      {/* LISTADO DE REUNIONES */}
      <main className="app-main">
        {error && (
          <div style={{ background: '#2a1111', color: '#ff6b6b', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            ⚠️ Error: {error}
          </div>
        )}

        {loading && (
          <div className="meetings-container">
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        )}

        {!loading && !error && reuniones.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">☕</div>
            <p className="empty-state-title">Sin reuniones para este día</p>
            <p className="empty-state-subtitle">¡Buen momento para prospectar!</p>
          </div>
        )}

        {!loading && !error && reuniones.length > 0 && (
          <div className="meetings-container">
            {reuniones.map(reunion => (
              <MeetingCard
                key={reunion.id}
                reunion={reunion}
                onSent={handleSentMessage}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal solo si es necesario manual */}
      <AddMeetingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddReunion}
      />

      <ToastContainer toasts={toasts} />
    </div>
  )
}
