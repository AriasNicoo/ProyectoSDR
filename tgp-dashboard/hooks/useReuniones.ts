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
  agregarReunion: (data: Omit<Reunion, 'id' | 'created_at' | 'updated_at' | 'estado_post_llamada' | 'estado_24h' | 'estado_1h' | 'estados_actualizados_en' | 'ultima_interaccion'>) => Promise<void>
  actualizarEstadoMensaje: (reunionId: string, tipo: TipoMensaje, estado: EstadoMensaje) => Promise<void>
  eliminarReunion: (reunionId: string) => Promise<void>
  refetch: () => Promise<void>
}

const CAMPO_MAP: Record<TipoMensaje, keyof Reunion> = {
  post_llamada: 'estado_post_llamada',
  '24h': 'estado_24h',
  '1h': 'estado_1h',
}

export function useReuniones(): UseReunionesReturn {
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltroState] = useState<FiltroFecha>('todos')

  const supabase = createClient()

  const fetchReuniones = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('reuniones')
        .select('*')
        .order('fecha_reunion', { ascending: true })

      const rango = getRangoFecha(filtro)
      if (rango) {
        query = query
          .gte('fecha_reunion', rango.desde)
          .lte('fecha_reunion', rango.hasta)
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
  }, [filtro]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFiltro = useCallback((f: FiltroFecha) => {
    setFiltroState(f)
  }, [])

  const agregarReunion = useCallback(async (
    data: Omit<Reunion, 'id' | 'created_at' | 'updated_at' | 'estado_post_llamada' | 'estado_24h' | 'estado_1h' | 'estados_actualizados_en' | 'ultima_interaccion'>
  ) => {
    const { error: err } = await supabase
      .from('reuniones')
      .insert([{
        ...data,
        estado_post_llamada: 'pendiente',
        estado_24h: 'pendiente',
        estado_1h: 'pendiente',
        estados_actualizados_en: null,
        ultima_interaccion: null,
      }])

    if (err) throw err
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
          ? { ...r, [campo]: estado, estados_actualizados_en: new Date().toISOString() }
          : r
      )
    )

    const { error: err } = await supabase
      .from('reuniones')
      .update({
        [campo]: estado,
        estados_actualizados_en: new Date().toISOString(),
      })
      .eq('id', reunionId)

    if (err) {
      // Revertir optimista si falla
      await fetchReuniones()
      throw err
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const eliminarReunion = useCallback(async (reunionId: string) => {
    // Optimistic removal
    setReuniones(prev => prev.filter(r => r.id !== reunionId))

    const { error: err } = await supabase
      .from('reuniones')
      .delete()
      .eq('id', reunionId)

    if (err) {
      await fetchReuniones()
      throw err
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    reuniones,
    loading,
    error,
    filtro,
    setFiltro,
    agregarReunion,
    actualizarEstadoMensaje,
    eliminarReunion,
    refetch: fetchReuniones,
  }
}
