-- ================================================================
-- SDR TRACKER — ProyectoSeguimientoTGP
-- SCRIPT SQL COMPLETO PARA SUPABASE
-- ================================================================
-- INSTRUCCIONES:
--   1. Abre el SQL Editor en tu proyecto de Supabase
--   2. Copia y pega TODO este archivo
--   3. Ejecuta el script completo (Run All)
--
-- Este script es IDEMPOTENTE: puede ejecutarse múltiples veces
-- sin romper datos existentes (usa IF NOT EXISTS / IF EXISTS).
-- ================================================================


-- ================================================================
-- SECCIÓN 1: TIPOS ENUM
-- ================================================================

-- Tipo para los 3 estados posibles de cada mensaje de seguimiento
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_mensaje') THEN
    CREATE TYPE estado_mensaje AS ENUM ('pendiente', 'enviado', 'no_aplica');
  END IF;
END $$;


-- ================================================================
-- SECCIÓN 2: TABLA PRINCIPAL — reuniones
-- ================================================================

CREATE TABLE IF NOT EXISTS reuniones (
  -- Identidad
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- SDR responsable
  sdr_name         TEXT,

  -- Datos de la reunión
  titulo_reunion   TEXT,

  -- Datos del prospecto
  empresa          TEXT,
  nombre_prospecto TEXT NOT NULL,
  correos_contacto TEXT,
  cargo            TEXT,
  telefono         TEXT,

  -- Tiempo
  fecha_reunion    TEXT NOT NULL,    -- formato: 'YYYY-MM-DD'
  hora_reunion     TEXT NOT NULL,    -- formato: 'HH:mm:ss'

  -- Origen del contacto
  email_origen     TEXT,
  agendado_para    TEXT,
  canal            TEXT,
  notas            TEXT,
  link_meet        TEXT,

  -- Estados de los 3 mensajes de seguimiento
  estado_post_llamada  TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_post_llamada IN ('pendiente', 'enviado', 'no_aplica')),
  estado_24h           TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_24h IN ('pendiente', 'enviado', 'no_aplica')),
  estado_1h            TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_1h IN ('pendiente', 'enviado', 'no_aplica')),

  -- Auditoría
  estados_actualizados_en  TIMESTAMPTZ,
  ultima_interaccion       TIMESTAMPTZ,

  -- Control de flujo: true = recién agendada, necesita confirmación post-llamada
  -- (BUG #1 FIX — Se agrega aquí en la creación para nuevas instancias)
  necesita_confirmacion    BOOLEAN NOT NULL DEFAULT true
);

-- ================================================================
-- SECCIÓN 2B: MIGRACIÓN — agregar columnas nuevas si ya existe la tabla
-- (para proyectos que ya tienen datos)
-- ================================================================

ALTER TABLE reuniones
  ADD COLUMN IF NOT EXISTS necesita_confirmacion BOOLEAN NOT NULL DEFAULT true;

-- Backfill: reuniones con post_llamada ya resuelto no necesitan confirmación
UPDATE reuniones
SET necesita_confirmacion = false
WHERE estado_post_llamada IN ('enviado', 'no_aplica')
  AND necesita_confirmacion = true;


-- ================================================================
-- SECCIÓN 3: TABLA SECUNDARIA — perfiles (SDRs)
-- ================================================================

CREATE TABLE IF NOT EXISTS perfiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  nombre_sdr   TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now()
);


-- ================================================================
-- SECCIÓN 4: ÍNDICES DE RENDIMIENTO
-- ================================================================

-- Búsqueda por fecha de reunión (tab L-V del dashboard)
CREATE INDEX IF NOT EXISTS idx_reuniones_fecha
  ON reuniones (fecha_reunion);

-- Búsqueda por estado post-llamada (usado en filtros)
CREATE INDEX IF NOT EXISTS idx_reuniones_estado_post
  ON reuniones (estado_post_llamada);

-- Búsqueda por la nueva columna (filtro "Por Avisar")
CREATE INDEX IF NOT EXISTS idx_reuniones_necesita_confirmacion
  ON reuniones (necesita_confirmacion)
  WHERE necesita_confirmacion = true;

-- Anti-duplicados: combinación nombre + fecha + hora
CREATE INDEX IF NOT EXISTS idx_reuniones_dedup
  ON reuniones (nombre_prospecto, fecha_reunion, hora_reunion);

-- Búsqueda por SDR (filtro multi-SDR futuro)
CREATE INDEX IF NOT EXISTS idx_reuniones_sdr
  ON reuniones (sdr_name);

-- Índice de perfiles por email
CREATE INDEX IF NOT EXISTS idx_perfiles_email
  ON perfiles (email);


-- ================================================================
-- SECCIÓN 5: ROW LEVEL SECURITY (RLS)
-- ================================================================

-- ── 5A. Tabla reuniones ─────────────────────────────────────────

ALTER TABLE reuniones ENABLE ROW LEVEL SECURITY;

-- Política de LECTURA: el SDR autenticado solo ve sus propias reuniones
-- (compara sdr_name con el campo nombre_sdr de su perfil)
DROP POLICY IF EXISTS "SDR puede leer sus reuniones" ON reuniones;
CREATE POLICY "SDR puede leer sus reuniones"
  ON reuniones
  FOR SELECT
  TO authenticated
  USING (
    sdr_name = (
      SELECT nombre_sdr FROM perfiles WHERE id = auth.uid()
    )
  );

-- Política de ACTUALIZACIÓN: el SDR solo puede actualizar sus reuniones
DROP POLICY IF EXISTS "SDR puede actualizar sus reuniones" ON reuniones;
CREATE POLICY "SDR puede actualizar sus reuniones"
  ON reuniones
  FOR UPDATE
  TO authenticated
  USING (
    sdr_name = (
      SELECT nombre_sdr FROM perfiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    sdr_name = (
      SELECT nombre_sdr FROM perfiles WHERE id = auth.uid()
    )
  );

-- Política de ELIMINACIÓN: el SDR solo puede borrar sus reuniones
DROP POLICY IF EXISTS "SDR puede eliminar sus reuniones" ON reuniones;
CREATE POLICY "SDR puede eliminar sus reuniones"
  ON reuniones
  FOR DELETE
  TO authenticated
  USING (
    sdr_name = (
      SELECT nombre_sdr FROM perfiles WHERE id = auth.uid()
    )
  );

-- Política de INSERCIÓN para el webhook de Slack (usa service_role key)
-- Con service_role key el RLS se bypass automáticamente, por lo que
-- no se necesita política de INSERT explícita para el webhook.
-- Si en algún momento se necesita insertar como anon, descomentar:
-- DROP POLICY IF EXISTS "Insercion via webhook" ON reuniones;
-- CREATE POLICY "Insercion via webhook"
--   ON reuniones FOR INSERT TO anon WITH CHECK (true);


-- ── 5B. Tabla perfiles ──────────────────────────────────────────

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Lectura: cada SDR solo ve su propio perfil
DROP POLICY IF EXISTS "SDR lee su propio perfil" ON perfiles;
CREATE POLICY "SDR lee su propio perfil"
  ON perfiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Inserción/actualización: cada SDR puede crear/actualizar su propio perfil
DROP POLICY IF EXISTS "SDR gestiona su propio perfil" ON perfiles;
CREATE POLICY "SDR gestiona su propio perfil"
  ON perfiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ================================================================
-- SECCIÓN 6: REALTIME
-- ================================================================

-- Habilitar publicación en tiempo real para la tabla reuniones
-- Esto alimenta la suscripción en useReuniones.ts
ALTER PUBLICATION supabase_realtime ADD TABLE reuniones;


-- ================================================================
-- SECCIÓN 7: FUNCIÓN AUXILIAR — normalizar hora
-- ================================================================

-- NOTA: hora_reunion está definida como tipo TIME en esta BD.
-- PostgreSQL normaliza el tipo TIME internamente a HH:mm:ss siempre,
-- por lo que '10:00' se guarda como '10:00:00' automáticamente.
-- Este trigger es una capa extra de seguridad en caso de que
-- el tipo sea TEXT en alguna instalación.

CREATE OR REPLACE FUNCTION normalizar_hora_reunion()
RETURNS TRIGGER AS $$
BEGIN
  -- Si hora_reunion es TEXT y viene como HH:mm (5 chars), completar con :00
  -- El ::text cast es necesario cuando el tipo de columna es TIME
  IF length(NEW.hora_reunion::text) = 5 THEN
    NEW.hora_reunion := (NEW.hora_reunion::text || ':00')::time;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que normaliza la hora en INSERT y UPDATE
DROP TRIGGER IF EXISTS trigger_normalizar_hora ON reuniones;
CREATE TRIGGER trigger_normalizar_hora
  BEFORE INSERT OR UPDATE OF hora_reunion ON reuniones
  FOR EACH ROW
  EXECUTE FUNCTION normalizar_hora_reunion();

-- Backfill: Si hora_reunion es de tipo TEXT y hay filas con formato HH:mm,
-- este UPDATE las normaliza. Si el tipo es TIME, PostgreSQL ya lo hizo
-- automáticamente y este UPDATE es un no-op seguro.
-- (El ::text cast evita el error 42883 con columnas de tipo TIME)
UPDATE reuniones
SET hora_reunion = (hora_reunion::text || ':00')::time
WHERE length(hora_reunion::text) = 5;


-- ================================================================
-- SECCIÓN 8: CONSTRAINT ANTI-DUPLICADOS (opcional pero recomendado)
-- ================================================================

-- Constraint de unicidad para evitar duplicados a nivel de BD
-- (capa extra de seguridad sobre el check en el código)
-- NOTA: Solo ejecutar si estás seguro de que no hay duplicados actuales.
-- Si falla por duplicados existentes, primero limpia los datos.

-- Para ver duplicados antes de agregar el constraint, ejecuta:
-- SELECT nombre_prospecto, fecha_reunion, hora_reunion, COUNT(*)
-- FROM reuniones
-- GROUP BY nombre_prospecto, fecha_reunion, hora_reunion
-- HAVING COUNT(*) > 1;

-- Una vez limpio, ejecuta:
-- ALTER TABLE reuniones
--   ADD CONSTRAINT uq_reunion_prospecto_fecha_hora
--   UNIQUE (nombre_prospecto, fecha_reunion, hora_reunion);


-- ================================================================
-- VERIFICACIÓN FINAL
-- ================================================================

-- Ejecuta esto al final para confirmar que todo quedó bien:
SELECT
  table_name,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('reuniones', 'perfiles')
ORDER BY table_name, ordinal_position;
