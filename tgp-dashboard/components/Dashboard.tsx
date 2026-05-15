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
import { FileSpreadsheet, LogOut, Trash2 } from 'lucide-react'
import { signOut } from '@/lib/actions/auth'

export function Dashboard() {
  const {
    reuniones,
    loading,
    error,
    filtro,
    setFiltro,
    actualizarEstadoMensaje,
    eliminarReunion,
    eliminarReunionesMasivo,
    refetch,
  } = useReuniones()

  const { toasts, addToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [excelModalOpen, setExcelModalOpen] = useState(false)
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([])

  const handleSentMessage = async (reunionId: string, tipo: TipoMensaje) => {
    try {
      await actualizarEstadoMensaje(reunionId, tipo, 'enviado')
      addToast('✓ Registro actualizado', 'success')
    } catch {
      addToast('No se pudo actualizar el estado', 'error')
    }
  }

  const handleDelete = async (reunionId: string) => {
    try {
      await eliminarReunion(reunionId)
      setSelectedMeetings(prev => prev.filter(id => id !== reunionId))
      addToast('🗑 Reunion eliminada', 'success')
    } catch {
      addToast('Error al eliminar la reunion', 'error')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedMeetings.length === 0) return
    if (!confirm(`¿Estás seguro de eliminar ${selectedMeetings.length} reuniones seleccionadas?`)) return

    try {
      await eliminarReunionesMasivo(selectedMeetings)
      setSelectedMeetings([])
      addToast(`🗑 ${selectedMeetings.length} reuniones eliminadas`, 'success')
    } catch {
      addToast('Error al eliminar las reuniones', 'error')
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedMeetings(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Limpiar selección cuando se cambia de pestaña
  const handleFiltroChange = (nuevoFiltro: any) => {
    setSelectedMeetings([])
    setFiltro(nuevoFiltro)
  }

  const handleAddReunion = async (data: any) => {
    addToast('⚠ Usa el canal de Slack o el importador de Excel para agregar reuniones de forma segura.', 'error')
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
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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

            {selectedMeetings.length > 0 && (
              <button
                onClick={handleBulkDelete}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#B71C1C',
                  border: '1px solid #9A0007',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px 12px',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(183, 28, 28, 0.4)'
                }}
              >
                <Trash2 size={15} />
                <span>Borrar ({selectedMeetings.length})</span>
              </button>
            )}

            <button
              onClick={() => signOut()}
              title="Cerrar Sesión"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)',
                width: '32px',
                height: '32px',
                color: '#ef4444',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* TABS DE NAVEGACION (L-V) */}
      <FilterBar
        filtroActivo={filtro}
        onFiltroChange={handleFiltroChange}
        onAgregarReunion={() => setModalOpen(true)}
        reuniones={reuniones}
      />

      {/* LISTADO DE REUNIONES */}
      <main className="app-main">
        {error && (
          <div style={{ background: '#2a1111', color: '#ff6b6b', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            ⚠ Error: {error}
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
            <p className="empty-state-title">Sin reuniones para este dia</p>
            <p className="empty-state-subtitle">Buen momento para prospectar!</p>
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
                isSelected={selectedMeetings.includes(reunion.id)}
                onToggleSelect={toggleSelection}
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

      {/* Modal para Importacion de Excel */}
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
