'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Reunion, FiltroFecha, TipoMensaje, EstadoMensaje } from '@/lib/types'
import { getRangoFecha } from '@/lib/utils'

interface UseReunionesReturn {
  reuniones: Reunion[]
  loading: boolean
  error: string | null
  filtro: FiltroFecha
  setFiltro: (f: FiltroFecha) => void
  actualizarEstadoMensaje: (reunionId: string, tipo: TipoMensaje, estado: EstadoMensaje) => Promise<void>
  eliminarReunion: (reunionId: string) => Promise<void>
  refetch: () => Promise<void>
}

const CAMPO_MAP: Record<TipoMensaje, keyof Reunion> = {
  post_llamada: 'estado_post_llamada',
  '24h': 'estado_24h',
  '1h': 'estado_1h',
}

// Determinar el día actual para el filtro inicial
const getInitialFilter = (): FiltroFecha => {
  const dia = new Date().getDay() // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sab
  const map: Record<number, FiltroFecha> = {
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes'
  }
  return map[dia] || 'lunes'
}

export function useReuniones(): UseReunionesReturn {
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltroState] = useState<FiltroFecha>(getInitialFilter())

  const supabase = createClient()

  const fetchReuniones = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('reuniones')
        .select('*')
        .order('hora_reunion', { ascending: true })

      const rango = getRangoFecha(filtro)
      if (rango) {
        query = query
          .eq('fecha_reunion', rango.desde)
      }

      const { data, error: err } = await query

      if (err) throw err
      setReuniones((data as Reunion[]) ?? [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al cargar reuniones'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [filtro]) // eslint-disable-line react-hooks/exhaustive-deps

  // Suscripción en tiempo real
  useEffect(() => {
    fetchReuniones()

    const channel = supabase
      .channel('reuniones-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reuniones' },
        () => fetchReuniones()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [filtro, fetchReuniones])

  const setFiltro = useCallback((f: FiltroFecha) => {
    setFiltroState(f)
  }, [])

  const actualizarEstadoMensaje = useCallback(async (
    reunionId: string,
    tipo: TipoMensaje,
    estado: EstadoMensaje
  ) => {
    const campo = CAMPO_MAP[tipo]

    // Actualización optimista local
    setReuniones(prev =>
      prev.map(r =>
        r.id === reunionId
          ? { ...r, [campo]: estado }
          : r
      )
    )

    const { error: err } = await supabase
      .from('reuniones')
      .update({
        [campo]: estado
      })
      .eq('id', reunionId)

    if (err) {
      await fetchReuniones()
      throw err
    }
  }, [fetchReuniones, supabase])

  const eliminarReunion = useCallback(async (reunionId: string) => {
    setReuniones(prev => prev.filter(r => r.id !== reunionId))

    const { error: err } = await supabase
      .from('reuniones')
      .delete()
      .eq('id', reunionId)

    if (err) {
      await fetchReuniones()
      throw err
    }
  }, [fetchReuniones, supabase])

  return {
    reuniones,
    loading,
    error,
    filtro,
    setFiltro,
    actualizarEstadoMensaje,
    eliminarReunion,
    refetch: fetchReuniones,
  }
}
