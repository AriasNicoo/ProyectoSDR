-- ================================================================
-- ACTUALIZACIÓN ESTRUCTURAL — SDR Tracker
-- Script limpio y consolidado para ejecutar en Supabase SQL Editor
-- ================================================================
-- Este script usa IF NOT EXISTS / WHERE para ser seguro de re-ejecutar.
-- ================================================================

-- 1. Columna para el cliente (empresa que contrata al SDR)
--    Ej: "Edenred Chile" — distinto de `empresa` (prospecto)
ALTER TABLE reuniones
  ADD COLUMN IF NOT EXISTS cliente TEXT;

-- 2. Columna de control de flujo para el filtro "Por Avisar"
--    true  = recién agendada por teléfono, necesita confirmación WhatsApp
--    false = agendada por mail (no necesita WA) o ya se envió la confirmación
ALTER TABLE reuniones
  ADD COLUMN IF NOT EXISTS necesita_confirmacion BOOLEAN NOT NULL DEFAULT true;

-- 3. Backfill: reuniones que ya tienen post_llamada resuelto no necesitan acción
UPDATE reuniones
SET necesita_confirmacion = false
WHERE estado_post_llamada IN ('enviado', 'no_aplica')
  AND necesita_confirmacion = true;
