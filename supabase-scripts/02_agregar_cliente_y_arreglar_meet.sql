-- ================================================================
-- MIGRACIÓN #02: Columna `cliente` en tabla reuniones
-- SDR Tracker — ProyectoSeguimientoTGP
-- ================================================================
-- INSTRUCCIONES: Copia y pega en el SQL Editor de Supabase y ejecuta.
-- ================================================================

-- Agregar la columna cliente (empresa que contrata al SDR, ej: "Edenred Chile")
-- Es distinto de `empresa` que es la empresa del prospecto (ej: "FORUS S.A")
ALTER TABLE reuniones
  ADD COLUMN IF NOT EXISTS cliente TEXT;

-- Backfill: intentar extraer el cliente desde el campo `notas`
-- donde el webhook lo guardaba con el formato [Cliente: Edenred Chile | ...]
UPDATE reuniones
SET cliente = TRIM(
  REGEXP_REPLACE(
    SUBSTRING(notas FROM '\[Cliente:\s*([^\]|]+)'),
    '^\s+|\s+$', '', 'g'
  )
)
WHERE notas ILIKE '%[Cliente:%'
  AND cliente IS NULL;

-- Verificar resultado
SELECT id, empresa, cliente, notas
FROM reuniones
WHERE cliente IS NOT NULL
LIMIT 20;
