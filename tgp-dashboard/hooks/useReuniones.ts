'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Reunion, FiltroFecha, TipoMensaje, EstadoMensaje } from '@/lib/types'
import { getRangoFecha } from '@/lib/utils'
import { format } from 'date-fns'

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
// Determinar el día actual para el filtro inicial, adelantando si ya terminó la jornada laboral
const getInitialFilter = (): FiltroFecha => {
  const hoy = new Date()
  const dia = hoy.getDay() // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sab

  // Si es viernes por la tarde (después de las 18:30), adelantamos al Lunes
  if (dia === 5) {
    const horaLimite = new Date()
    horaLimite.setHours(18, 30, 0, 0)
    if (hoy > horaLimite) {
      return 'lunes'
    }
    return 'viernes'
  }

  const map: Record<number, FiltroFecha> = {
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves'
  }
  return map[dia] || 'lunes'
}

export function useReuniones(): UseReunionesReturn {
  const [reuniones, setReuniones] = useState<Reunion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Usamos 'todos' como inicial fijo para evitar mismatch de hidratación (SSR vs Client)
  const [filtro, setFiltroState] = useState<FiltroFecha>('todos')
  const [isMounted, setIsMounted] = useState(false)

  const supabase = createClient()

  const fetchReuniones = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const hoyObj = new Date()
      const hoyStr = format(hoyObj, 'yyyy-MM-dd')
      const diaSemana = hoyObj.getDay()
      let adelantarSemana = false

      if (diaSemana === 5) { // Hoy es Viernes
        // Buscamos la última reunión de hoy viernes
        const { data: ultReunion } = await supabase
          .from('reuniones')
          .select('hora_reunion')
          .eq('fecha_reunion', hoyStr)
          .order('hora_reunion', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (ultReunion) {
          const [h, m] = ultReunion.hora_reunion.split(':').map(Number)
          const horaUltimaReunion = new Date()
          horaUltimaReunion.setHours(h, m, 0, 0)
          
          if (new Date() > horaUltimaReunion) {
            adelantarSemana = true
          }
        } else {
          // Fallback por defecto si no hay reuniones el viernes: las 18:30 hrs
          const horaLimite = new Date()
          horaLimite.setHours(18, 30, 0, 0)
          if (new Date() > horaLimite) {
            adelantarSemana = true
          }
        }
      }

      let query = supabase
        .from('reuniones')
        .select('*')
        .gte('fecha_reunion', hoyStr) // Solo mostrar desde hoy en adelante
        .order('fecha_reunion', { ascending: true })
        .order('hora_reunion', { ascending: true })

      const rango = getRangoFecha(filtro, adelantarSemana)
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

  // Efecto 1: Hidratación y selección del filtro inicial real una sola vez en cliente
  useEffect(() => {
    setFiltroState(getInitialFilter())
    setIsMounted(true)
  }, [])

  // Efecto 2: Suscripción en tiempo real y carga de datos al cambiar el filtro
  useEffect(() => {
    if (!isMounted) return

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
  }, [filtro, fetchReuniones, isMounted, supabase])

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
