-- ================================================================
-- SDR TRACKER — ProyectoSeguimientoTGP
-- SCHEMA COMPLETO DE SUPABASE
-- ================================================================
-- INSTRUCCIONES:
--   Copia y pega TODO este archivo en el SQL Editor de Supabase
--   y ejecútalo completo cada vez que haya cambios.
--
--   Este script es IDEMPOTENTE: puede ejecutarse múltiples veces
--   sin romper datos existentes.
-- ================================================================


-- ================================================================
-- SECCIÓN 1: TABLA PRINCIPAL — reuniones
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
  empresa          TEXT,                    -- Empresa del prospecto (ej: "FORUS S.A")
  nombre_prospecto TEXT NOT NULL,
  correos_contacto TEXT,
  cargo            TEXT,
  telefono         TEXT,

  -- Tiempo
  fecha_reunion    TEXT NOT NULL,           -- formato: 'YYYY-MM-DD'
  hora_reunion     TIME NOT NULL,           -- formato: 'HH:mm:ss'

  -- Origen del contacto
  email_origen     TEXT,
  agendado_para    TEXT,
  canal            TEXT,
  notas            TEXT,                    -- Texto raw completo del mensaje del bot
  link_meet        TEXT,

  -- Cliente = empresa que contrata al SDR (ej: "Edenred Chile")
  -- Distinto de `empresa` que es la empresa del prospecto
  cliente          TEXT,

  -- Estados de los 3 mensajes de seguimiento WhatsApp
  estado_post_llamada  TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_post_llamada IN ('pendiente', 'enviado', 'no_aplica')),
  estado_24h           TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_24h IN ('pendiente', 'enviado', 'no_aplica')),
  estado_1h            TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_1h IN ('pendiente', 'enviado', 'no_aplica')),

  -- Control de flujo filtro "Por Avisar"
  -- true  = agendado por teléfono, necesita mensaje de confirmación WhatsApp
  -- false = agendado por mail (no necesita WA) o confirmación ya enviada
  necesita_confirmacion BOOLEAN NOT NULL DEFAULT true,

  -- Auditoría
  estados_actualizados_en  TIMESTAMPTZ,
  ultima_interaccion       TIMESTAMPTZ
);


-- ================================================================
-- SECCIÓN 2: MIGRACIONES — agregar columnas si ya existe la tabla
-- (seguro para bases de datos con datos existentes)
-- ================================================================

ALTER TABLE reuniones ADD COLUMN IF NOT EXISTS cliente               TEXT;
ALTER TABLE reuniones ADD COLUMN IF NOT EXISTS necesita_confirmacion BOOLEAN NOT NULL DEFAULT true;


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

CREATE INDEX IF NOT EXISTS idx_reuniones_fecha
  ON reuniones (fecha_reunion);

CREATE INDEX IF NOT EXISTS idx_reuniones_estado_post
  ON reuniones (estado_post_llamada);

CREATE INDEX IF NOT EXISTS idx_reuniones_necesita_confirmacion
  ON reuniones (necesita_confirmacion)
  WHERE necesita_confirmacion = true;

CREATE INDEX IF NOT EXISTS idx_reuniones_dedup
  ON reuniones (nombre_prospecto, fecha_reunion, hora_reunion);

CREATE INDEX IF NOT EXISTS idx_reuniones_sdr
  ON reuniones (sdr_name);

CREATE INDEX IF NOT EXISTS idx_perfiles_email
  ON perfiles (email);


-- ================================================================
-- SECCIÓN 5: ROW LEVEL SECURITY (RLS)
-- ================================================================

-- ── 5A. Tabla reuniones ─────────────────────────────────────────

ALTER TABLE reuniones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SDR puede leer sus reuniones"       ON reuniones;
DROP POLICY IF EXISTS "SDR puede actualizar sus reuniones" ON reuniones;
DROP POLICY IF EXISTS "SDR puede eliminar sus reuniones"   ON reuniones;

CREATE POLICY "SDR puede leer sus reuniones"
  ON reuniones FOR SELECT TO authenticated
  USING (
    sdr_name = (SELECT nombre_sdr FROM perfiles WHERE id = auth.uid())
  );

CREATE POLICY "SDR puede actualizar sus reuniones"
  ON reuniones FOR UPDATE TO authenticated
  USING (
    sdr_name = (SELECT nombre_sdr FROM perfiles WHERE id = auth.uid())
  )
  WITH CHECK (
    sdr_name = (SELECT nombre_sdr FROM perfiles WHERE id = auth.uid())
  );

CREATE POLICY "SDR puede eliminar sus reuniones"
  ON reuniones FOR DELETE TO authenticated
  USING (
    sdr_name = (SELECT nombre_sdr FROM perfiles WHERE id = auth.uid())
  );

-- ── 5B. Tabla perfiles ──────────────────────────────────────────

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SDR lee su propio perfil"     ON perfiles;
DROP POLICY IF EXISTS "SDR gestiona su propio perfil" ON perfiles;

CREATE POLICY "SDR lee su propio perfil"
  ON perfiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "SDR gestiona su propio perfil"
  ON perfiles FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ================================================================
-- SECCIÓN 6: REALTIME
-- ================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reuniones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reuniones;
  END IF;
END $$;


-- ================================================================
-- SECCIÓN 7: BACKFILL DE DATOS EXISTENTES
-- ================================================================

-- Reuniones que ya tienen post_llamada resuelto no necesitan confirmación
UPDATE reuniones
SET necesita_confirmacion = false
WHERE estado_post_llamada IN ('enviado', 'no_aplica')
  AND necesita_confirmacion = true;

-- Intentar extraer cliente desde notas antiguas con formato [Cliente: Nombre | ...]
UPDATE reuniones
SET cliente = TRIM(
  SUBSTRING(notas FROM 'Cliente:\s*([^\]|]+)')
)
WHERE notas ILIKE '%cliente:%'
  AND cliente IS NULL;


-- ================================================================
-- SECCIÓN 8: VERIFICACIÓN FINAL
-- ================================================================

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
