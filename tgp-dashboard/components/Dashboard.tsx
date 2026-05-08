'use client'

import { useState } from 'react'
import { useReuniones } from '@/hooks/useReuniones'
import { useToast } from '@/hooks/useToast'
import { FilterBar } from './FilterBar'
import { MeetingCard } from './MeetingCard'
import { AddMeetingModal } from './AddMeetingModal'
import { ImportExcelModal } from './ImportExcelModal'
import { ToastContainer } from './ToastContainer'
import type { TipoMensaje } from '@/lib/types'
import { FileSpreadsheet } from 'lucide-react'

export function Dashboard() {
  const {
    reuniones,
    loading,
    error,
    filtro,
    setFiltro,
    actualizarEstadoMensaje,
    eliminarReunion,
    refetch,
  } = useReuniones()

  const { toasts, addToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [excelModalOpen, setExcelModalOpen] = useState(false)

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
    addToast('⚠️ Usa el canal de Slack o el importador de Excel para agregar reuniones de forma segura.', 'error')
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
        <div className="app-header-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="app-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="app-logo-title">SDR TRACKER</span>
            {pendienteCount > 0 && (
              <div className="stat-pill">
                {pendienteCount} pendientes
              </div>
            )}
          </div>
          
          <button
            onClick={() => setExcelModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-green)';
              e.currentTarget.style.boxShadow = '0 0 10px var(--accent-green-glow)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            }}
          >
            <FileSpreadsheet style={{ color: 'var(--accent-green)', width: '15px', height: '15px' }} />
            <span>Importar Excel</span>
          </button>
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

      {/* Modal para Importación de Excel */}
      <ImportExcelModal
        open={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        onSuccess={(msg) => addToast(msg, 'success')}
        onError={(msg) => addToast(msg, 'error')}
        onRefetch={refetch}
      />

      <ToastContainer toasts={toasts} />
    </div>
  )
}
