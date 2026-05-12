# 📋 Ficha Técnica — SDR Tracker (ProyectoSeguimientoTGP)

## 1. Descripción General

**Nombre del sistema:** SDR Tracker / TGP Dashboard
**Propósito:** Dashboard interno para que los SDRs (Sales Development Representatives) de la empresa **The Growth Pro** hagan seguimiento de sus reuniones agendadas y gestionen el envío de mensajes de WhatsApp de confirmación/recordatorio a prospectos.

**Flujo principal:**
1. Un SDR agenda una reunión (por llamada, email o WhatsApp)
2. El bot de Slack recibe automáticamente los datos → los inserta en Supabase
3. El SDR abre el dashboard → ve la reunión → manda mensaje de WhatsApp de confirmación (post-llamada)
4. 24h antes de la reunión → manda recordatorio
5. 1h antes → manda recordatorio final

**Dominio restringido:** Solo cuentas con email `@thegrowth.pro` pueden iniciar sesión (validado en el callback de OAuth).

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework Frontend/Backend | **Next.js** | 16.2.6 |
| Lenguaje | **TypeScript** | ^5 |
| UI | **React** | 19.2.4 |
| Estilos | **Vanilla CSS** (design tokens, dark mode industrial) | — |
| Base de datos + Auth | **Supabase** (PostgreSQL + Auth + Realtime) | JS SDK ^2.105.3 |
| Supabase SSR | `@supabase/ssr` | ^0.10.3 |
| Procesamiento de Excel | **xlsx** (SheetJS) | ^0.18.5 |
| Fechas | **date-fns** | ^4.1.0 |
| Iconos | **lucide-react** | ^1.14.0 |
| Bot de notificaciones | **Slack API** (webhook + bot token) | — |
| Mensajería | **WhatsApp** (via `api.whatsapp.com/send`) | — |

**Runtime:** Node.js (Windows, desarrollo local con `npm run dev`)
**Directorio activo del proyecto Next.js:** `tgp-dashboard/` (dentro del repo raíz `ProyectoSeguimientoTGP/`)

---

## 3. Estructura de Archivos Clave

```
tgp-dashboard/
├── app/
│   ├── layout.tsx                    # Layout raíz con fuentes
│   ├── page.tsx                      # Redirige al dashboard
│   ├── globals.css                   # Sistema de diseño completo (CSS tokens)
│   ├── login/
│   │   └── page.tsx                  # Pantalla de login Google OAuth
│   ├── auth/callback/                # Callback de Supabase OAuth (valida dominio)
│   ├── completar-perfil/
│   │   └── page.tsx                  # Formulario inicial de nombre SDR
│   └── api/webhook/slack/
│       └── route.ts                  # Webhook receptor de Slack (POST handler)
│
├── components/
│   ├── Dashboard.tsx                 # Componente raíz del dashboard
│   ├── FilterBar.tsx                 # Tabs de navegación (Por Avisar, L-V, Todos)
│   ├── MeetingCard.tsx               # Tarjeta individual de reunión
│   ├── WhatsAppButton.tsx            # Botón de acción WhatsApp/Email por tipo
│   ├── ImportExcelModal.tsx          # Modal: subir Excel o pegar mensaje Slack
│   ├── AddMeetingModal.tsx           # Modal: agregar reunión (deshabilitado, solo informativo)
│   └── ToastContainer.tsx            # Sistema de notificaciones toast
│
├── hooks/
│   ├── useReuniones.ts               # Hook principal: fetch, filtros, realtime, CRUD
│   └── useToast.ts                   # Hook para sistema de toasts
│
└── lib/
    ├── types.ts                      # Interfaces TypeScript del sistema
    ├── utils.ts                      # Helpers: fechas, mensajes WhatsApp, URLs
    ├── supabase/
    │   ├── client.ts                 # Cliente Supabase para browser (componentes cliente)
    │   ├── server.ts                 # Cliente Supabase para servidor (SSR/Server Actions)
    │   └── proxy.ts                  # Middleware/proxy Supabase
    └── actions/
        ├── auth.ts                   # Server Actions: signInWithGoogle, signOut
        └── perfil.ts                 # Server Action: actualizarPerfilSDR
```

---

## 4. Esquema de Base de Datos Supabase

### Tabla principal: `reuniones`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid (PK) | ID único |
| `created_at` | timestamp | Fecha de creación del registro |
| `sdr_name` | text \| null | Nombre del SDR responsable |
| `titulo_reunion` | text \| null | Título descriptivo |
| `empresa` | text \| null | Empresa del prospecto |
| `nombre_prospecto` | text | **Nombre del contacto** |
| `correos_contacto` | text \| null | Email(s) del contacto |
| `cargo` | text \| null | Cargo del contacto |
| `telefono` | text \| null | Teléfono (formato `569XXXXXXXX`) |
| `fecha_reunion` | text | Fecha en formato `YYYY-MM-DD` |
| `hora_reunion` | text | Hora en formato `HH:mm:ss` |
| `email_origen` | text \| null | Email desde donde salió la reunión |
| `agendado_para` | text \| null | Ejecutivo/SDR para quien se agenda |
| `canal` | text \| null | Canal de origen (CALL, EMAIL, WHATSAPP) |
| `notas` | text \| null | Contexto + metadatos en formato `[Cliente: X \| Pod: Y]` |
| `link_meet` | text \| null | URL de Google Meet |
| `estado_post_llamada` | enum | `'pendiente'` \| `'enviado'` \| `'no_aplica'` |
| `estado_24h` | enum | `'pendiente'` \| `'enviado'` \| `'no_aplica'` |
| `estado_1h` | enum | `'pendiente'` \| `'enviado'` \| `'no_aplica'` |
| `estados_actualizados_en` | timestamp \| null | Última actualización de estados |
| `ultima_interaccion` | timestamp \| null | Última interacción registrada |

### Tabla secundaria: `perfiles`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid (FK → auth.users) | ID del usuario Supabase |
| `email` | text | Email corporativo |
| `nombre_sdr` | text | Nombre completo del SDR |
| `updated_at` | timestamp | Última actualización |

---

## 5. Tipos TypeScript Principales

```typescript
// lib/types.ts

export type EstadoMensaje = 'pendiente' | 'enviado' | 'no_aplica'
export type TipoMensaje = 'post_llamada' | '24h' | '1h'
export type FiltroFecha = 'por_enviar' | 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'todos'

export interface Reunion {
  id: string
  created_at: string
  sdr_name: string | null
  titulo_reunion: string | null
  empresa: string | null
  nombre_prospecto: string
  correos_contacto: string | null
  cargo: string | null
  telefono: string | null
  fecha_reunion: string        // "YYYY-MM-DD"
  hora_reunion: string         // "HH:mm:ss"
  email_origen: string | null
  agendado_para: string | null
  canal: string | null
  notas: string | null
  link_meet: string | null
  estado_post_llamada: EstadoMensaje
  estado_24h: EstadoMensaje
  estado_1h: EstadoMensaje
  estados_actualizados_en?: string | null
  ultima_interaccion?: string | null
}
```

---

## 6. Flujo de Datos

### Ingesta automática (Slack → Dashboard)
```
Slack mensaje (formato estructurado)
  → POST /api/webhook/slack
    → Parsea regex los campos (Empresa, Nombre, Día y Hora, Teléfono, SDR, etc.)
    → Normaliza teléfono (formato 569XXXXXXXX)
    → Check anti-duplicados (nombre_prospecto + fecha_reunion + hora_reunion)
    → INSERT en supabase tabla 'reuniones'
    → Reacción ✅/❌ en Slack como confirmación
    → Realtime Supabase notifica al dashboard abierto → auto-refresh
```

### Ingesta manual (Excel/Paste)
```
Usuario abre ImportExcelModal
  → Tab "Subir Excel": drag & drop .xlsx/.xls/.csv
    → Parsea con SheetJS, mapeo inteligente de columnas por keywords
    → Preview en tabla → Usuario confirma
    → Loop INSERT con mismo check anti-duplicados
  → Tab "Pegar Slack": textarea con el texto del mensaje
    → Mismo parser regex que el webhook
    → Preview → Confirma → INSERT
```

### Envío de seguimiento (Dashboard → WhatsApp)
```
SDR ve la tarjeta → Pulsa botón (Post / 24h / 1h)
  → buildWhatsAppMessage() genera el texto personalizado
  → buildWhatsAppURL() genera https://api.whatsapp.com/send?phone=...&text=...
  → window.open() abre WhatsApp en nueva pestaña
  → onSent() → UPDATE en Supabase (estado → 'enviado')
  → Actualización optimista local en React
```

---

## 7. Funcionalidades Actuales

| Funcionalidad | Estado |
|---|---|
| Auth Google OAuth (dominio @thegrowth.pro) | ✅ Activo |
| Perfil SDR (nombre para firma de reuniones) | ✅ Activo |
| Dashboard mobile-first (dark mode) | ✅ Activo |
| Filtro por día semana (L-V + Todos) | ✅ Activo |
| Filtro "Por Avisar" (post-llamada pendiente) | ✅ Activo (con bug) |
| Realtime Supabase (auto-refresh) | ✅ Activo |
| Tarjetas de reunión con todos los datos | ✅ Activo |
| Botones WhatsApp (Post / 24h / 1h) | ✅ Activo (mensajes a mejorar) |
| Actualización optimista de estados | ✅ Activo |
| Eliminación de reuniones | ✅ Activo |
| Webhook Slack automático | ✅ Activo |
| Anti-duplicados (webhook + Excel) | ✅ Activo (con bug) |
| Importador Excel (.xlsx/.xls/.csv) | ✅ Activo |
| Parser de mensaje Slack manual | ✅ Activo |
| Sistema de Toasts (feedback visual) | ✅ Activo |
| Skeletons de carga | ✅ Activo |

---

## 8. 🔴 Bugs Activos a Corregir (Priorizados)

---

### BUG #1 — Filtro "Por Avisar" tiene lógica incorrecta
**Archivo:** `hooks/useReuniones.ts` → función `fetchReuniones()` (línea ~102-106)
**Archivo secundario:** `components/FilterBar.tsx` (label del filtro)

**Problema actual:**
El filtro muestra **todas** las reuniones con `estado_post_llamada = 'pendiente'`, sin importar cuándo se agendaron ni si tienen teléfono.

**Comportamiento deseado:**
- Solo mostrar reuniones que **acaban de ser agendadas** (via Slack o importación)
- Solo si el prospecto **tiene teléfono** (`telefono IS NOT NULL AND telefono != ''`)
- El propósito es: el SDR manda el mensaje de confirmación inmediato post-llamada
- Una vez marcado como `'enviado'`, la reunión sale del filtro y queda en el tab del día que le corresponde

**Lógica sugerida:**
```
estado_post_llamada = 'pendiente'
AND telefono IS NOT NULL AND telefono != ''
AND created_at >= NOW() - INTERVAL '24 hours'   ← distingue "nueva" vs "vieja pendiente"
```
O alternativamente, agregar columna booleana `necesita_confirmacion` a la tabla para control explícito.

---

### BUG #2 — Reuniones se registran duplicadas
**Archivo:** `app/api/webhook/slack/route.ts` (línea ~135-156)
**Archivo:** `components/ImportExcelModal.tsx` (línea ~458-481)

**Problema actual:**
El check de duplicados compara exactamente `nombre_prospecto + fecha_reunion + hora_reunion`. Si la hora viene en formato `HH:mm` (sin segundos) en un caso y `HH:mm:ss` en el otro, el match falla y se inserta dos veces.

**Ejemplo del fallo:**
- Webhook guarda `hora_reunion = '10:00'`
- Importador busca con `hora_reunion = '10:00:00'`
- No coincide → INSERT duplicado

**Fix requerido:**
Normalizar la hora a `HH:mm:ss` antes del check en **ambos lugares**. Función de normalización:
```typescript
const normalizarHora = (h: string) => h.length === 5 ? `${h}:00` : h
```

---

### BUG #3 — Mensajes de WhatsApp necesitan estructura definida
**Archivo:** `lib/utils.ts` → función `buildWhatsAppMessage()` (línea ~59-92)

**Problema actual:**
Los 3 mensajes (post_llamada, 24h, 1h) tienen texto genérico que no refleja el tono/estructura real que el SDR usa.

**Fix requerido:**
Redefinir el texto exacto de los 3 mensajes. El usuario debe proveer el template exacto. Variables disponibles:
- `primerNombre` — primer nombre del prospecto
- `fechaTexto` — fecha formateada en español ("Mañana, 14:00" / "lunes 13 de mayo, 14:00")
- `linkMeet` — URL de Google Meet (opcional)

---

### BUG #4 — Token CSS `--accent-red` no definido
**Archivo:** `app/globals.css` → bloque `:root` (línea ~7-33)
**Afecta:** `components/MeetingCard.tsx` (botón eliminar, línea 95)

**Problema:** El botón de eliminar usa `color: 'var(--accent-red)'` pero ese token CSS no existe en `:root`. Se renderiza sin color.

**Fix:** Agregar en `:root`:
```css
--accent-red: #f85149;
--accent-red-glow: rgba(248, 81, 73, 0.4);
```

---

### BUG #5 — Webhook usa clave pública de Supabase en servidor
**Archivo:** `app/api/webhook/slack/route.ts` (líneas 4-7)

**Problema:**
```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   // ← ANON KEY en servidor
)
```
El webhook es una **Route Handler de Next.js** (corre en servidor). Debe usar `SUPABASE_SERVICE_ROLE_KEY` (variable privada, sin `NEXT_PUBLIC_`) para garantizar permisos de escritura independientemente de las políticas RLS.

**Fix:**
```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // ← Service Role (privada)
)
```
Y agregar `SUPABASE_SERVICE_ROLE_KEY=...` al `.env.local`.

---

## 9. Variables de Entorno Requeridas (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...       ← Necesaria para BUG #5
SLACK_BOT_TOKEN=xoxb-...              ← Para reacciones y mensajes de Slack
```

---

## 10. Notas de Arquitectura Importantes

- **No usar `cd` en comandos PowerShell** — el entorno lo requiere.
- **El proyecto Next.js vive en `tgp-dashboard/`**, no en la raíz del repo.
- Hay una raíz del repo con carpetas `app/`, `components/`, etc. que son de un proyecto anterior/diferente y **no se usan**. Todo el trabajo activo está en `tgp-dashboard/`.
- **Next.js versión 16** (cutting edge, no es Next.js 13/14/15). Consultar `tgp-dashboard/node_modules/next/dist/docs/` ante cualquier duda de API.
- **Supabase Realtime** está activo con canal `'reuniones-realtime'` — cualquier cambio en la tabla `reuniones` dispara un re-fetch automático en todos los clientes conectados.
- Los **mensajes de WhatsApp** se abren via `window.open()` con la URL `https://api.whatsapp.com/send` — no hay API de WhatsApp Business integrada, es redirección al app nativo.
- La **hidratación SSR/Client** está manejada con `isMounted` en `useReuniones.ts` para evitar mismatch entre el filtro inicial del servidor y el cliente.
