'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  eliminarReunionesMasivo: (ids: string[]) => Promise<void>
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
  const hasAutoRedirected = useRef(false)

  const supabase = createClient()

  const fetchReuniones = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const hoyObj = new Date()
      // Helper para ajustar a la zona horaria local correcta (formato YYYY-MM-DD)
      const hoyStr = hoyObj.toLocaleDateString('en-CA') // YYYY-MM-DD local
      const diaSemana = hoyObj.getDay()
      let adelantarSemana = false

      // === LIMPIEZA AUTOMÁTICA DE REUNIONES PASADAS ===
      // Cada vez que cargan las reuniones, borramos de Supabase lo que sea < hoyStr
      // Lo hacemos sin esperar (.then) para no bloquear la interfaz
      supabase.from('reuniones')
        .delete()
        .lt('fecha_reunion', hoyStr)
        .then(({ error: deleteErr }) => {
          if (deleteErr) console.error("Error auto-limpiando reuniones pasadas:", deleteErr)
        })

      if (diaSemana === 5) { // Hoy es Viernes
        // Hora límite estricta: 18:30
        const horaLimiteFija = new Date()
        horaLimiteFija.setHours(18, 30, 0, 0)
        
        if (hoyObj >= horaLimiteFija) {
          adelantarSemana = true
        } else {
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
            const horaTerminoUltimaReunion = new Date()
            // Se asume que la reunión dura 1 hora, así que adelantamos la semana 
            // 1 hora después de la última reunión agendada.
            horaTerminoUltimaReunion.setHours(h + 1, m, 0, 0)
            
            if (hoyObj >= horaTerminoUltimaReunion) {
              adelantarSemana = true
            }
          }
        }

        // Si se determinó adelantar la semana, y estamos parados en la pestaña de "Viernes",
        // automáticamente saltamos al "Lunes" de la próxima semana para que el usuario 
        // no vea el próximo viernes vacío.
        // PERO solo lo hacemos 1 vez por sesión, para que el usuario sí pueda clickear "Viernes" 
        // si explícitamente quiere ver el próximo viernes.
        if (adelantarSemana && filtro === 'viernes' && !hasAutoRedirected.current) {
          hasAutoRedirected.current = true
          setFiltroState('lunes')
          return // Cortamos la ejecución, el setFiltroState disparará un nuevo fetchReuniones
        }
      }

      let query = supabase.from('reuniones').select('*')

      if (filtro === 'por_enviar') {
        // "Por Avisar": recién agendadas que necesitan el mensaje de confirmación
        // y que tienen teléfono para poder enviar WhatsApp
        query = query
          .eq('necesita_confirmacion', true)
          .not('telefono', 'is', null)
          .neq('telefono', '')
          .order('created_at', { ascending: false })
      } else {
        // Comportamiento normal de calendario
        query = query
          .order('fecha_reunion', { ascending: true })
          .order('hora_reunion', { ascending: true })

        const rango = getRangoFecha(filtro, adelantarSemana)
        if (rango) {
          // Filtro por día específico (Lunes a Viernes). Muestra TODAS las reuniones de ese día
          query = query.eq('fecha_reunion', rango.desde)
        } else {
          // Si es "Todos", mostramos desde hoy en adelante para no ver el historial completo
          query = query.gte('fecha_reunion', hoyStr)
        }
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
        { event: 'INSERT', schema: 'public', table: 'reuniones' },
        () => fetchReuniones()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reuniones' },
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
    setReuniones(prev => {
      // Si estamos en "Por Avisar" y marcamos el post_llamada de cualquier estado → quitar visualmente
      if (filtro === 'por_enviar' && campo === 'estado_post_llamada') {
        return prev.filter(r => r.id !== reunionId)
      }
      // Si no, solo actualizamos el estado visual de la tarjeta
      return prev.map(r => r.id === reunionId ? { ...r, [campo]: estado } : r)
    })

    // Payload base para Supabase
    const updatePayload: Record<string, unknown> = { [campo]: estado }

    // Al confirmar el post-llamada, la reunión ya no necesita confirmación
    if (tipo === 'post_llamada' && estado === 'enviado') {
      updatePayload.necesita_confirmacion = false
    }

    const { error: err } = await supabase
      .from('reuniones')
      .update(updatePayload)
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

  const eliminarReunionesMasivo = useCallback(async (reunionIds: string[]) => {
    setReuniones(prev => prev.filter(r => !reunionIds.includes(r.id)))

    const { error: err } = await supabase
      .from('reuniones')
      .delete()
      .in('id', reunionIds)

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
    eliminarReunionesMasivo,
    refetch: fetchReuniones,
  }
}
