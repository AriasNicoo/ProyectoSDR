'use client'

import type { FiltroFecha, Reunion } from '@/lib/types'

interface FilterBarProps {
  filtroActivo: FiltroFecha
  onFiltroChange: (f: FiltroFecha) => void
  onAgregarReunion: () => void
  reuniones: Reunion[]
}

const FILTROS_GENERALES: { key: FiltroFecha; label: string }[] = [
  { key: 'por_enviar', label: '📤 Por Avisar' },
  { key: 'todos',      label: 'Todos' },
]

const FILTROS_DIAS: { key: FiltroFecha; label: string; short: string }[] = [
  { key: 'lunes',     label: 'Lunes',     short: 'L' },
  { key: 'martes',    label: 'Martes',    short: 'M' },
  { key: 'miercoles', label: 'Miercoles', short: 'X' },
  { key: 'jueves',    label: 'Jueves',    short: 'J' },
  { key: 'viernes',   label: 'Viernes',   short: 'V' },
]

export function FilterBar({ filtroActivo, onFiltroChange, onAgregarReunion, reuniones }: FilterBarProps) {
  return (
    <div className="tab-navigation">

      {/* FILA SUPERIOR: Filtros generales (Por Avisar + Todos) */}
      <div className="tab-list-top">
        {FILTROS_GENERALES.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={filtroActivo === key}
            className={`tab-item tab-item-general ${key === 'por_enviar' ? 'tab-item-alert' : ''} ${filtroActivo === key ? 'active' : ''}`}
            onClick={() => onFiltroChange(key)}
          >
            <span className="tab-label-full">{label}</span>
            {filtroActivo === key && reuniones.length > 0 && (
              <span className="tab-badge">{reuniones.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* FILA INFERIOR: Días de la semana (L-V) */}
      <div className="tab-list" role="tablist">
        {FILTROS_DIAS.map(({ key, label, short }) => (
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
        aria-label="Agregar reunion"
      >
        <span>+</span>
      </button>
    </div>
  )
}
