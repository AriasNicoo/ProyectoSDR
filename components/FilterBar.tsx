'use client'

import type { FiltroFecha, Reunion } from '@/lib/types'

interface FilterBarProps {
  filtroActivo: FiltroFecha
  onFiltroChange: (f: FiltroFecha) => void
  onAgregarReunion: () => void
  reuniones: Reunion[]
}

const FILTROS: { key: FiltroFecha; label: string; emoji: string }[] = [
  { key: 'hoy',    label: 'Hoy',    emoji: '☀️' },
  { key: 'manana', label: 'Mañana', emoji: '📅' },
  { key: 'lunes',  label: 'Lunes',  emoji: '🗓️' },
  { key: 'todos',  label: 'Todos',  emoji: '📋' },
]

export function FilterBar({ filtroActivo, onFiltroChange, onAgregarReunion, reuniones }: FilterBarProps) {
  return (
    <div className="filter-bar" role="toolbar" aria-label="Filtros de fecha">
      <span className="filter-label">Vista</span>

      {FILTROS.map(({ key, label, emoji }) => (
        <button
          key={key}
          id={`filter-btn-${key}`}
          className={`filter-btn ${filtroActivo === key ? 'active' : ''}`}
          onClick={() => onFiltroChange(key)}
          aria-pressed={filtroActivo === key}
          aria-label={`Filtrar por ${label}`}
        >
          <span>{emoji}</span>
          <span>{label}</span>
          {filtroActivo === key && (
            <span className="filter-count">{reuniones.length}</span>
          )}
        </button>
      ))}

      <div className="filter-divider" aria-hidden="true" />

      <button
        id="btn-nueva-reunion"
        className="btn-add-meeting"
        onClick={onAgregarReunion}
        aria-label="Agregar nueva reunión"
      >
        <span>+</span>
        <span>Nueva Reunión</span>
      </button>
    </div>
  )
}
