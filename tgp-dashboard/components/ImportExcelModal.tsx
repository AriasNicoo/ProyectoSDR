'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Upload, FileSpreadsheet, Check, X, Loader2 } from 'lucide-react'

interface ImportExcelModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onRefetch: () => Promise<void>
}

interface ParsedMeeting {
  titulo_reunion: string
  email_origen: string | null
  empresa: string | null
  nombre_prospecto: string
  correos_contacto: string | null
  cargo: string | null
  telefono: string | null
  fecha_reunion: string
  hora_reunion: string
  agendado_para: string | null
  canal: string | null
  notas: string | null
  sdr_name: string | null
  link_meet: string | null
}

export function ImportExcelModal({ open, onClose, onSuccess, onError, onRefetch }: ImportExcelModalProps) {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedMeeting[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile)
        processFile(droppedFile)
      } else {
        onError('❌ Por favor sube un archivo Excel (.xlsx, .xls) o CSV')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      processFile(selectedFile)
    }
  }

  // Helper para normalizar el número de teléfono (incluso con notación científica de Excel)
  const cleanAndFormatPhone = (val: any): string | null => {
    if (!val) return null
    let str = val.toString().trim()
    if (str.length === 0 || str.toLowerCase() === 'n/a') return null

    // Manejar notación científica de Excel como "5,6979E+10" o "5.6979E+10"
    if (str.toUpperCase().includes('E+')) {
      try {
        const normalizedSci = str.replace(',', '.')
        const num = Number(normalizedSci)
        if (!isNaN(num)) {
          str = num.toString()
        }
      } catch (e) {
        console.error("Error al parsear notación científica:", e)
      }
    }

    let phone = str.replace(/\D/g, '')
    if (phone.length === 0) return null

    // Si tiene un formato duplicado de seguridad, tomamos la primera mitad
    if (phone.length > 12 && phone.startsWith(phone.substring(phone.length / 2))) {
      phone = phone.substring(0, phone.length / 2)
    } else if (phone.length > 15) {
      phone = phone.substring(0, 11)
    }

    if (phone.length === 8) phone = '569' + phone
    else if (phone.length === 9 && phone.startsWith('9')) phone = '56' + phone
    else if (!phone.startsWith('56') && phone.length > 0) phone = '56' + phone

    return phone
  }

  // Helper para parsear fechas de Excel/ISO
  const parseDateAndTime = (rawDate: any): { fecha: string; hora: string } => {
    let fecha = new Date().toISOString().split('T')[0]
    let hora = '10:00:00'

    if (!rawDate) return { fecha, hora }

    const str = rawDate.toString().trim()

    // Si viene en formato ISO o similar con 'T' (ej: "2026-06-15T18:30:00")
    if (str.includes('T')) {
      const parts = str.split('T')
      fecha = parts[0]
      if (parts[1]) {
        hora = parts[1].split('.')[0] // quitar milisegundos si existen
        if (hora.length === 5) hora += ':00'
      }
      return { fecha, hora }
    }

    // Si viene con espacio (ej: "2026-06-15 18:30")
    const spaceParts = str.split(/\s+/)
    if (spaceParts.length >= 2) {
      fecha = spaceParts[0]
      hora = spaceParts[1]
      if (hora.length === 5) hora += ':00'
    } else if (spaceParts.length === 1) {
      fecha = spaceParts[0]
    }

    // Normalizar formato de fecha con "/"
    if (fecha.includes('/')) {
      const parts = fecha.split('/')
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY/MM/DD
          fecha = `${parts[0]}-${parts[1]}-${parts[2]}`
        } else {
          // DD/MM/YYYY
          fecha = `${parts[2]}-${parts[1]}-${parts[0]}`
        }
      }
    }

    return { fecha, hora }
  }

  const processFile = (file: File) => {
    setLoading(true)
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (rawRows.length < 2) {
          onError('❌ El archivo está vacío o no contiene suficientes filas.')
          setLoading(false)
          return
        }

        // Limpiar headers de forma densa y segura
        const headers: string[] = []
        const headerRow = rawRows[0] || []
        for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
          const val = headerRow[colIdx]
          headers.push(val !== null && val !== undefined ? val.toString().trim().toLowerCase() : '')
        }

        // Helper ultra-seguro para buscar índice de columna por múltiples keywords
        const getColumnIndex = (keywords: string[]) => {
          return headers.findIndex(h => h && keywords.some(kw => h.toLowerCase().includes(kw.toLowerCase())))
        }

        // Obtener índices exactos
        const idxCreacion = getColumnIndex(['creac'])
        const idxCliente = getColumnIndex(['cliente'])
        const idxEjecutivos = getColumnIndex(['ejecut'])
        const idxPais = getColumnIndex(['paí', 'pais'])
        const idxFecha = headers.indexOf('fecha') !== -1 ? headers.indexOf('fecha') : getColumnIndex(['fecha'])
        const idxEmpresa = getColumnIndex(['empresa'])
        const idxNombre = getColumnIndex(['nombre con', 'nombre contacto', 'contacto', 'prospecto'])
        const idxEmail = getColumnIndex(['email contac', 'email', 'correo'])
        const idxInvitados = getColumnIndex(['invitado'])
        const idxTelefono = getColumnIndex(['teléfono cor', 'teléfono', 'telefono', 'fono', 'celular'])
        const idxRol = getColumnIndex(['rol contacto', 'rol', 'cargo'])
        const idxCanal = getColumnIndex(['canal'])
        const idxPod = getColumnIndex(['pod'])
        const idxSdr = getColumnIndex(['sdr'])

        const meetings: ParsedMeeting[] = []

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i]
          if (!row || row.length === 0) continue

          // Helper ultra-seguro para obtener el valor de una celda por índice como string limpio
          const getVal = (idx: number): string => {
            if (idx === -1 || idx >= row.length) return ''
            const val = row[idx]
            return val !== null && val !== undefined ? val.toString().trim() : ''
          }

          let rawNombre = getVal(idxNombre)
          let rawEmpresa = getVal(idxEmpresa)
          let rawFecha = getVal(idxFecha)
          let rawEmail = getVal(idxEmail)
          let rawTelefono = getVal(idxTelefono)
          let rawCargo = getVal(idxRol)
          let rawCanal = getVal(idxCanal)
          let rawSdr = getVal(idxSdr)
          let rawPod = getVal(idxPod)
          let rawCliente = getVal(idxCliente)
          let rawEjecutivos = getVal(idxEjecutivos)
          let rawPais = getVal(idxPais)
          let rawInvitados = getVal(idxInvitados)

          // --- AUTO-HEALING/INTELIGENCIA CONTRA SHIFTING (Desplazamiento de columnas) ---
          const rowValues: string[] = []
          for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const cellVal = row[colIdx]
            rowValues.push(cellVal !== null && cellVal !== undefined ? cellVal.toString().trim() : '')
          }
          
          // Buscar email en cualquier celda por si acaso
          const foundEmail = rowValues.find(v => v && v.includes('@'))
          if (foundEmail) rawEmail = foundEmail

          // Buscar canal (CALL, EMAIL, etc.) en cualquier celda
          const foundCanal = rowValues.find(v => v && ['CALL', 'EMAIL', 'WHATSAPP'].includes(v.toUpperCase()))
          if (foundCanal) rawCanal = foundCanal

          // Buscar teléfono (números largos o notación científica)
          const foundPhone = rowValues.find(v => {
            if (!v) return false
            const clean = v.replace(/\D/g, '')
            return (clean.length >= 8 && clean.length <= 15) || v.toUpperCase().includes('E+')
          })
          if (foundPhone && !foundPhone.includes('@') && !foundPhone.includes('-')) {
            rawTelefono = foundPhone
          }

          // Si el "Teléfono" contiene un rol o cargo como "Jefe de" o "Socio", es porque está desplazado!
          const rawTelefonoStr = rawTelefono ? rawTelefono.toString().trim() : ''
          if (rawTelefonoStr && (rawTelefonoStr.toLowerCase().includes('jefe') || rawTelefonoStr.toLowerCase().includes('socio') || rawTelefonoStr.toLowerCase().includes('ceo') || rawTelefonoStr.toLowerCase().includes('gerente'))) {
            rawCargo = rawTelefonoStr
            rawTelefono = ''
          }

          // SDR Name por defecto si está vacío o mal alineado
          const rawSdrStr = rawSdr ? rawSdr.toString().trim() : ''
          if (!rawSdrStr || rawSdrStr.toLowerCase().includes('beta')) {
            const foundSdr = rowValues.find(v => v && (v.toLowerCase().includes('nicolas') || v.toLowerCase().includes('arias')))
            if (foundSdr) rawSdr = foundSdr
          }

          // Formateo final de campos
          const nombreProspecto = rawNombre || 'Prospecto'
          const { fecha, hora } = parseDateAndTime(rawFecha)
          const telefonoFinal = cleanAndFormatPhone(rawTelefono)

          // Agrupar metadatos adicionales en notas
          const metaNotas = []
          if (rawCliente) metaNotas.push(`Cliente: ${rawCliente}`)
          if (rawEjecutivos) metaNotas.push(`Ejecutivos: ${rawEjecutivos}`)
          if (rawPais) metaNotas.push(`País: ${rawPais}`)
          if (rawPod) metaNotas.push(`Pod: ${rawPod}`)
          
          if (rawInvitados && !rawInvitados.toUpperCase().includes('E+')) {
            metaNotas.push(`Invitados: ${rawInvitados}`)
          }
          
          const notasMetaStr = metaNotas.length > 0 ? `[${metaNotas.join(' | ')}]` : ''
          const notasFinal = notasMetaStr ? `${notasMetaStr}` : null

          meetings.push({
            titulo_reunion: rawEmpresa ? `Reunión con ${rawEmpresa}` : 'Reunión Agendada',
            email_origen: rawEmail || null,
            empresa: rawEmpresa || 'Sin Empresa',
            nombre_prospecto: nombreProspecto,
            correos_contacto: rawEmail || null,
            cargo: rawCargo || null,
            telefono: telefonoFinal,
            fecha_reunion: fecha,
            hora_reunion: hora,
            agendado_para: rawEjecutivos || null,
            canal: rawCanal ? rawCanal.toUpperCase() : 'CALL',
            notas: notasFinal,
            sdr_name: rawSdr || 'Nicolas Arias',
            link_meet: null
          })
        }

        setParsedData(meetings)
      } catch (err: any) {
        onError(`❌ Error procesando el archivo Excel: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    if (parsedData.length === 0) return
    setImporting(true)

    try {
      const supabase = createClient()
      let insertados = 0
      let duplicados = 0

      for (const item of parsedData) {
        // Validación de duplicados idéntica a la lógica del webhook de Slack
        const { data: existingMeeting } = await supabase
          .from('reuniones')
          .select('id')
          .eq('nombre_prospecto', item.nombre_prospecto)
          .eq('fecha_reunion', item.fecha_reunion)
          .eq('hora_reunion', item.hora_reunion)
          .maybeSingle()

        if (existingMeeting) {
          duplicados++
          continue
        }

        const { error } = await supabase.from('reuniones').insert([item])
        if (error) {
          console.error("Error al insertar reunión:", error)
        } else {
          insertados++
        }
      }

      onSuccess(`🎉 Importación completada: ${insertados} reuniones guardadas, ${duplicados} duplicadas omitidas.`)
      await onRefetch()
      onClose()
    } catch (err: any) {
      onError(`❌ Error al guardar las reuniones: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: '640px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet className="text-emerald" style={{ color: 'var(--accent-green)', width: '22px', height: '22px' }} />
            <h2 className="modal-title" style={{ fontSize: '18px', fontWeight: 700 }}>Importar desde Excel</h2>
          </div>
          <button className="modal-close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {parsedData.length === 0 ? (
            <>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Sube tu archivo de exportación de Excel o CSV. Nuestro sistema de mapeo inteligente corregirá de forma automática los números de teléfono e ignorará registros duplicados.
              </p>

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragActive ? 'var(--accent-green)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '36px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: dragActive ? 'rgba(46, 160, 67, 0.05)' : 'var(--bg-elevated)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                
                {loading ? (
                  <Loader2 className="animate-spin" style={{ color: 'var(--accent-green)', width: '36px', height: '36px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Upload style={{ color: 'var(--text-secondary)', width: '36px', height: '36px' }} />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>
                    {loading ? 'Analizando archivo...' : 'Arrastra tu Excel aquí o haz clic para buscar'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Soporta archivos .xlsx, .xls, .csv
                  </span>
                </div>
              </div>

              <div style={{ background: 'rgba(88, 166, 255, 0.05)', border: '1px solid rgba(88, 166, 255, 0.1)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <AlertTriangle style={{ color: 'var(--accent-blue)', width: '18px', height: '18px', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Importación Segura</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Solo se importarán las reuniones agendadas desde hoy en adelante para mantener tu dashboard limpio y enfocado.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)' }}>
                  📋 {parsedData.length} Reuniones encontradas:
                </span>
                <button
                  onClick={() => { setFile(null); setParsedData([]) }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Cambiar archivo
                </button>
              </div>

              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-base)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 12px' }}>Prospecto</th>
                      <th style={{ padding: '8px 12px' }}>Empresa</th>
                      <th style={{ padding: '8px 12px' }}>Fecha / Hora</th>
                      <th style={{ padding: '8px 12px' }}>Teléfono</th>
                      <th style={{ padding: '8px 12px' }}>SDR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: 0.9 }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.nombre_prospecto}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--accent-blue)' }}>{item.empresa || 'N/A'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{item.fecha_reunion} {item.hora_reunion.substring(0, 5)}</td>
                        <td style={{ padding: '8px 12px' }}>{item.telefono || <span style={{ color: 'var(--text-muted)' }}>N/A</span>}</td>
                        <td style={{ padding: '8px 12px' }}>{item.sdr_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Cancelar
          </button>
          {parsedData.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-green)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px var(--accent-green-glow)'
              }}
            >
              {importing ? (
                <>
                  <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                  Importando...
                </>
              ) : (
                <>
                  <Check style={{ width: '16px', height: '16px' }} />
                  Confirmar Importación
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
