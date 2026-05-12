# Ficha Tecnica — SDR Tracker (ProyectoSeguimientoTGP)
Actualizada: 12 de mayo de 2026

---

## 1. Descripcion General

**Nombre:** SDR Tracker / TGP Dashboard
**Empresa:** The Growth Pro (TGP)
**Proposito:** Dashboard interno para SDRs — seguimiento de reuniones agendadas y gestion del envio de mensajes WhatsApp (confirmacion post-llamada, recordatorio 24h y 1h antes) a prospectos.

**Flujo principal:**
1. Bot de Slack detecta mensaje estructurado → POST automatico al webhook
2. Webhook parsea el mensaje, extrae campos y guarda en Supabase
3. SDR abre dashboard → ve reunion en "Por Avisar" (si tiene telefono) → manda WA de confirmacion
4. Reunion pasa al tab del dia correspondiente → SDR manda recordatorios 24h y 1h antes
5. Si llega un **Reagendamiento**, el sistema ACTUALIZA la reunion existente (no crea duplicado)

**Dominio restringido:** Solo cuentas @thegrowth.pro pueden iniciar sesion.

---

## 2. Stack Tecnologico

| Capa | Tecnologia | Version |
|---|---|---|
| Framework | Next.js | 16.2.6 |
| Lenguaje | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Estilos | Vanilla CSS (dark mode industrial) | - |
| Base de datos + Auth | Supabase (PostgreSQL + Auth + Realtime) | SDK ^2.105.3 |
| Supabase SSR | @supabase/ssr | ^0.10.3 |
| Procesamiento Excel | SheetJS (xlsx) | ^0.18.5 |
| Fechas | date-fns | ^4.1.0 |
| Iconos | lucide-react | ^1.14.0 |
| Bot notificaciones | Slack API (Events API + Bot Token) | - |
| Mensajeria | WhatsApp via api.whatsapp.com/send | - |

**Runtime:** Node.js / Windows
**Dev server:** npm run dev desde tgp-dashboard/
**Repo:** AriasNicoo/ProyectoSeguimientoTGP (rama main)

---

## 3. Estructura de Archivos

```
ProyectoSeguimientoTGP/
├── supabase-scripts/
│   └── schema.sql                  <- UNICO script SQL (copiar completo en Supabase)
│
└── tgp-dashboard/                  <- Proyecto Next.js activo
    ├── app/
    │   ├── globals.css             <- Diseno completo (CSS tokens, dark mode)
    │   ├── layout.tsx
    │   ├── page.tsx                <- Redirige al dashboard
    │   ├── login/page.tsx          <- Login Google OAuth
    │   ├── completar-perfil/page.tsx
    │   ├── auth/callback/route.ts  <- Callback OAuth (valida dominio)
    │   └── api/webhook/slack/route.ts <- Webhook receptor de Slack
    │
    ├── components/
    │   ├── Dashboard.tsx           <- Componente raiz del dashboard
    │   ├── FilterBar.tsx           <- Navegacion: 2 filas (generales + dias L-V)
    │   ├── MeetingCard.tsx         <- Tarjeta de reunion
    │   ├── WhatsAppButton.tsx      <- Botones WA por tipo de mensaje
    │   ├── ImportExcelModal.tsx    <- Modal: subir Excel o pegar mensaje Slack
    │   ├── AddMeetingModal.tsx     <- Modal informativo
    │   └── ToastContainer.tsx      <- Notificaciones toast
    │
    ├── hooks/
    │   ├── useReuniones.ts         <- Hook principal: fetch, filtros, realtime, CRUD
    │   └── useToast.ts
    │
    └── lib/
        ├── types.ts                <- Interfaces TypeScript
        ├── utils.ts                <- Helpers: fechas, mensajes WA, URLs
        ├── supabase/client.ts      <- Cliente browser (ANON_KEY)
        ├── supabase/server.ts      <- Cliente servidor (SSR)
        └── actions/auth.ts + perfil.ts
```

---

## 4. Schema Base de Datos

### Tabla reuniones

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | auto |
| created_at | TIMESTAMPTZ | auto |
| sdr_name | TEXT | Nombre SDR (de tabla perfiles) |
| titulo_reunion | TEXT | Auto: "Reunion con {empresa}" |
| empresa | TEXT | Empresa del PROSPECTO (ej: FORUS S.A) |
| nombre_prospecto | TEXT NOT NULL | |
| correos_contacto | TEXT | |
| cargo | TEXT | |
| telefono | TEXT | Formato 569XXXXXXXX |
| fecha_reunion | TEXT | YYYY-MM-DD |
| hora_reunion | TIME | HH:mm:ss |
| email_origen | TEXT | Mail del SDR del cliente |
| agendado_para | TEXT | Ejecutivos TGP invitados |
| canal | TEXT | CALL, EMAIL, WHATSAPP |
| notas | TEXT | Texto raw completo del mensaje del bot |
| link_meet | TEXT | URL meet.google.com/xxx-xxx-xxx |
| cliente | TEXT | Empresa CLIENTE de TGP (ej: Edenred Chile) |
| estado_post_llamada | TEXT | pendiente, enviado, no_aplica |
| estado_24h | TEXT | pendiente, enviado, no_aplica |
| estado_1h | TEXT | pendiente, enviado, no_aplica |
| necesita_confirmacion | BOOLEAN | true = tiene telefono, necesita WA post-llamada |
| estados_actualizados_en | TIMESTAMPTZ | |
| ultima_interaccion | TIMESTAMPTZ | |

### Tabla perfiles

| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | FK -> auth.users |
| email | TEXT | |
| nombre_sdr | TEXT | Nombre completo del SDR |
| updated_at | TIMESTAMPTZ | |

---

## 5. Tipos TypeScript

```typescript
export type EstadoMensaje = 'pendiente' | 'enviado' | 'no_aplica'
export type TipoMensaje = 'post_llamada' | '24h' | '1h'
export type FiltroFecha = 'por_enviar' | 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'todos'

export interface Reunion {
  id: string
  created_at: string
  sdr_name: string | null
  titulo_reunion: string | null
  empresa: string | null            // Empresa del prospecto
  nombre_prospecto: string
  correos_contacto: string | null
  cargo: string | null
  telefono: string | null
  fecha_reunion: string             // "YYYY-MM-DD"
  hora_reunion: string              // "HH:mm:ss"
  email_origen: string | null
  agendado_para: string | null
  canal: string | null
  notas: string | null              // Texto raw del bot
  link_meet: string | null
  cliente: string | null            // Empresa cliente de TGP
  estado_post_llamada: EstadoMensaje
  estado_24h: EstadoMensaje
  estado_1h: EstadoMensaje
  necesita_confirmacion: boolean
}
```

---

## 6. Flujo de Datos

### Ingesta automatica (Slack -> Dashboard)

```
Mensaje Slack bot estructurado
  -> POST /api/webhook/slack
    -> Detecta si es Reagendamiento (primera linea)
    |
    |-- REAGENDAMIENTO -> busca por nombre_prospecto -> UPDATE
    |     (nueva fecha/hora/link, reset estados, necesita_confirmacion)
    |     Slack: Reagendamiento aplicado!
    |
    +-- NUEVO AGENDAMIENTO
          -> Parsea campos con regex (strip markdown Slack)
          -> Extrae cliente de primera linea dinamicamente
          -> Extrae link Meet regex estricto (meet.google.com/xxx-xxx-xxx)
          -> Contexto multilínea (acepta "Contexto Reunion :")
          -> Normaliza telefono (569XXXXXXXX)
          -> Check anti-duplicados (nombre + fecha + hora)
          -> INSERT: necesita_confirmacion = hayTelefono
          -> Slack: Listo! La reunion con X esta en el Dashboard.
          -> Realtime -> auto-refresh dashboard
```

### Ingesta manual (Excel / Texto pegado)

```
ImportExcelModal
  |-- Tab Excel: drag & drop .xlsx/.xls/.csv
  |     -> SheetJS parsea columnas por keywords
  |     -> Normaliza telefonos (incluye notacion cientifica 5.6E+10)
  |     -> Preview -> Confirmar -> INSERT con anti-duplicados
  |
  +-- Tab Slack: textarea pegar mensaje
        -> Mismo parser regex del webhook
        -> Preview -> Confirmar -> INSERT

En ambos: sdr_name = perfil del usuario logueado (sin hardcode)
```

### Envio WhatsApp

```
SDR pulsa boton (Post / 24h / 1h)
  -> buildWhatsAppMessage(tipo, nombre, fecha, hora, link, sdr, cliente)
  -> buildWhatsAppURL -> api.whatsapp.com/send?phone=...&text=...
  -> window.open() -> WhatsApp nativo
  -> UPDATE en Supabase
     (si post_llamada=enviado: tambien necesita_confirmacion=false)
  -> Actualizacion optimista React
```

---

## 7. Templates WhatsApp

**post_llamada:**
Hola {nombre}, por aca {sdr} de {cliente}. Tal como conversamos por telefono, la reunion quedo agendada para el dia {fecha}. Te adjunto el link para que puedas aceptar en tu calendario: {link_meet}. Saludos!

**24h:**
Hola {nombre}, como estas? Te escribo de {cliente} para recordarte nuestra reunion de manana a las {hora}. Te dejo el link de acceso a mano para que nos conectemos: {link_meet}. Que tengas buen dia!

**1h:**
Hola {nombre}, buen dia! Te recuerdo que en un ratito, a las {hora}, tenemos nuestra reunion. Nos vemos en este link: {link_meet}. Nos vemos ahi!

---

## 8. FilterBar Layout

```
+--------------------------------------------+
|    [Por Avisar]        [Todos]             |  <- Fila superior, centrada
+--------------------------------------------+  <- separador sutil
| [Lunes] [Martes] [Miercoles] [Jueves] [V] |  <- Fila inferior L-V
+--------------------------------------------+
                                        [+]    <- FAB verde
```

---

## 9. Logica del Filtro "Por Avisar"

Condicion de aparicion:
- necesita_confirmacion = true (tiene telefono, aun no confirmada)
- telefono IS NOT NULL y != ''

necesita_confirmacion = false cuando:
- estado_post_llamada = 'enviado' (SDR envio WA de confirmacion)
- Agendado por mail sin telefono (se setea false en INSERT)

---

## 10. Funcionalidades Activas

| Funcionalidad | Estado |
|---|---|
| Auth Google OAuth (dominio @thegrowth.pro) | OK |
| Perfil SDR (nombre para mensajes WA) | OK |
| Dashboard mobile-first dark mode industrial | OK |
| FilterBar 2 filas (generales + dias L-V) | OK |
| Filtro Por Avisar con necesita_confirmacion | OK |
| Filtro por dia de semana (L-V) + Todos | OK |
| Tab automatico al dia actual | OK |
| Realtime Supabase (auto-refresh) | OK |
| Tarjetas: cliente, empresa prospecto, SDR, cargo, telefono, Meet | OK |
| Botones WhatsApp (Post / 24h / 1h) con templates oficiales | OK |
| Actualizacion optimista de estados | OK |
| Eliminacion de reuniones | OK |
| Webhook Slack - parser robusto + strip markdown | OK |
| Webhook Slack - link Meet regex estricto | OK |
| Webhook Slack - Contexto Reunion con espacio opcional | OK |
| Webhook Slack - anti-duplicados | OK |
| Webhook Slack - Reagendamiento (UPDATE vs INSERT) | OK |
| Webhook usa SUPABASE_SERVICE_ROLE_KEY | OK |
| Importador Excel (.xlsx/.xls/.csv) | OK |
| Importador - telefonos con notacion cientifica | OK |
| Importador - SDR desde perfil logueado (sin hardcode) | OK |
| Parser Slack manual (textarea) | OK |
| Cliente dinamico para cualquier empresa TGP | OK |
| Sistema de Toasts | OK |
| Skeletons de carga | OK |

---

## 11. Variables de Entorno (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SLACK_BOT_TOKEN=xoxb-...
```

Las mismas variables deben estar en la plataforma de deploy (Vercel/Railway).

---

## 12. Script SQL

Archivo: supabase-scripts/schema.sql
Uso: Copiar completo y pegar en SQL Editor de Supabase. Es idempotente.
Contiene: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS, indices, RLS policies, Realtime (con check de existencia), backfill de datos.

---

## 13. Notas de Arquitectura

- El proyecto Next.js vive EXCLUSIVAMENTE en tgp-dashboard/
- Next.js version 16 — revisar node_modules/next/dist/docs/ antes de usar APIs
- Hidratacion SSR/Client manejada con isMounted en useReuniones.ts
- Realtime activo — cualquier cambio en la tabla dispara re-fetch en todos los dashboards
- WhatsApp via window.open() con api.whatsapp.com/send (no hay API Business)
- notas guarda el texto raw completo del bot (trazabilidad total)
- cliente (empresa de TGP) es DISTINTO de empresa (empresa del prospecto)
  Ejemplo: cliente = "Edenred Chile", empresa = "FORUS S.A"
- sdr_name viene siempre del perfil en Supabase, nunca hardcodeado
