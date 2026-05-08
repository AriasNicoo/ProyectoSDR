'use client'

import type { FiltroFecha, Reunion } from '@/lib/types'

interface FilterBarProps {
  filtroActivo: FiltroFecha
  onFiltroChange: (f: FiltroFecha) => void
  onAgregarReunion: () => void
  reuniones: Reunion[]
}

const FILTROS: { key: FiltroFecha; label: string; short: string }[] = [
  { key: 'lunes',     label: 'Lunes',     short: 'L' },
  { key: 'martes',    label: 'Martes',    short: 'M' },
  { key: 'miercoles', label: 'Miércoles', short: 'M' },
  { key: 'jueves',    label: 'Jueves',    short: 'J' },
  { key: 'viernes',   label: 'Viernes',   short: 'V' },
]

export function FilterBar({ filtroActivo, onFiltroChange, onAgregarReunion, reuniones }: FilterBarProps) {
  return (
    <div className="tab-navigation">
      <div className="tab-list" role="tablist">
        {FILTROS.map(({ key, label, short }) => (
          <button
            key={key}
            role="tab"
            aria-selected={filtroActivo === key}
            className={`tab-item ${filtroActivo === key ? 'active' : ''}`}
            onClick={() => onFiltroChange(key)}
          >
            <span className="tab-label-full">{label}</span>
            <span className="tab-label-short">{short}</span>
            {filtroActivo === key && reuniones.length > 0 && (
              <span className="tab-badge">{reuniones.length}</span>
            )}
          </button>
        ))}
      </div>
      
      <button
        className="fab-add"
        onClick={onAgregarReunion}
        aria-label="Agregar reunión"
      >
        <span>+</span>
      </button>
    </div>
  )
}
