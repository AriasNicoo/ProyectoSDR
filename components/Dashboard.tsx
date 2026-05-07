'use client'

import { useState } from 'react'
import { useReuniones } from '@/hooks/useReuniones'
import { useToast } from '@/hooks/useToast'
import { FilterBar } from './FilterBar'
import { MeetingCard } from './MeetingCard'
import { AddMeetingModal } from './AddMeetingModal'
import { ToastContainer } from './ToastContainer'
import { agruparPorFecha } from '@/lib/utils'
import type { TipoMensaje } from '@/lib/types'
import { format, isToday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'

export function Dashboard() {
  const {
    reuniones,
    loading,
    error,
    filtro,
    setFiltro,
    agregarReunion,
    actualizarEstadoMensaje,
    eliminarReunion,
  } = useReuniones()

  const { toasts, addToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)

  const handleSentMessage = async (reunionId: string, tipo: TipoMensaje) => {
    try {
      await actualizarEstadoMensaje(reunionId, tipo, 'enviado')
      addToast('✅ Mensaje marcado como enviado', 'success')
    } catch {
      addToast('No se pudo actualizar el estado', 'error')
    }
  }

  const handleDelete = async (reunionId: string) => {
    try {
      await eliminarReunion(reunionId)
      addToast('Reunión eliminada', 'success')
    } catch {
      addToast('Error al eliminar la reunión', 'error')
    }
  }

  const handleAddReunion = async (data: Parameters<typeof agregarReunion>[0]) => {
    try {
      await agregarReunion(data)
      addToast('🎉 Reunión agregada correctamente', 'success')
    } catch {
      addToast('Error al agregar la reunión', 'error')
      throw new Error('failed')
    }
  }

  // Agrupar reuniones por fecha para secciones visuales
  const grupos = agruparPorFecha(reuniones)

  const formatGroupHeader = (fechaKey: string): string => {
    const fecha = new Date(fechaKey + 'T12:00:00') // evita offset issues
    if (isToday(fecha)) return '☀️ Hoy'
    if (isTomorrow(fecha)) return '📅 Mañana'
    return format(fecha, "EEEE d 'de' MMMM", { locale: es })
  }

  const pendienteCount = reuniones.filter(r =>
    r.estado_post_llamada !== 'enviado' ||
    r.estado_24h !== 'enviado' ||
    r.estado_1h !== 'enviado'
  ).length

  return (
    <>
      {/* HEADER */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">
            <div className="app-logo-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20.52 3.449C18.24 1.245 15.24 0 12 0 5.373 0 0 5.373 0 12c0 2.117.554 4.188 1.606 6.007L0 24l6.15-1.582A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12 0-3.21-1.243-6.228-3.48-8.551z"
                  fill="white"
                  opacity=".9"
                />
              </svg>
            </div>
            <div className="app-logo-text">
              <span className="app-logo-title">TGP Dashboard</span>
              <span className="app-logo-subtitle">Seguimiento de Reuniones</span>
            </div>
          </div>

          <div className="header-stats">
            {pendienteCount > 0 && (
              <div className="stat-pill">
                <div className="stat-pill-dot" />
                <span>{pendienteCount} pendiente{pendienteCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="stat-pill">
              <span>📊</span>
              <span>{reuniones.length} reunión{reuniones.length !== 1 ? 'es' : ''}</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="app-main" id="main-content">
        <FilterBar
          filtroActivo={filtro}
          onFiltroChange={setFiltro}
          onAgregarReunion={() => setModalOpen(true)}
          reuniones={reuniones}
        />

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md)',
            color: '#ef4444',
            fontSize: '14px',
            marginBottom: 'var(--space-md)',
          }}>
            ⚠️ {error} — Verifica tu conexión y las variables de entorno de Supabase.
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="meetings-container">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton skeleton-card" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && reuniones.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-title">Sin reuniones en esta vista</p>
            <p className="empty-state-subtitle">
              Cambia el filtro o agrega una nueva reunión para empezar.
            </p>
            <button
              className="btn-add-meeting"
              onClick={() => setModalOpen(true)}
              style={{ marginLeft: 0 }}
            >
              + Nueva Reunión
            </button>
          </div>
        )}

        {/* Meetings grouped by date */}
        {!loading && !error && reuniones.length > 0 && (
          <div className="meetings-container">
            {Object.entries(grupos).map(([fechaKey, grupo]) => (
              <div key={fechaKey} className="date-group">
                <div className="date-group-label">
                  <span>{formatGroupHeader(fechaKey)}</span>
                  <div className="date-group-line" aria-hidden="true" />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {grupo.length} reunión{grupo.length !== 1 ? 'es' : ''}
                  </span>
                </div>

                {grupo.map(reunion => (
                  <MeetingCard
                    key={reunion.id}
                    reunion={reunion}
                    onSent={handleSentMessage}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      <AddMeetingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddReunion}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} />
    </>
  )
}
