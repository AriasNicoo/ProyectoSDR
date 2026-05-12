import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addSlackReaction(channelId: string, timestamp: string, emoji: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch('https://slack.com/api/reactions.add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel: channelId, name: emoji, timestamp: timestamp })
    });
  } catch (error) {
    console.error("Error añadiendo reacción en Slack:", error);
  }
}

async function sendSlackConfirmation(channelId: string, text: string, threadTs?: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel: channelId, text: text, thread_ts: threadTs })
    });
  } catch (error) {
    console.error("Error enviando mensaje a Slack:", error);
  }
}

/**
 * Extrae un campo de una línea con formato "Clave: Valor".
 * Maneja variantes de acentos (ej: "Día" / "Dia").
 */
function extract(texto: string, regex: RegExp): string | null {
  const match = texto.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extrae texto multilínea entre dos marcadores.
 * Captura todo hasta el siguiente campo conocido o fin de texto.
 */
function extractMultiline(texto: string, regex: RegExp): string | null {
  const match = texto.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Normaliza el número de teléfono al formato internacional chileno 569XXXXXXXX.
 */
function normalizarTelefono(raw: string | null): string {
  if (!raw || raw.toUpperCase() === 'N/A') return '';

  let phone = raw.replace(/\D/g, '');
  if (phone.length === 0) return '';

  // Si hay duplicación (ej: 569...569...), tomar solo la primera mitad
  if (phone.length > 12 && phone.startsWith(phone.substring(Math.floor(phone.length / 2)))) {
    phone = phone.substring(0, Math.floor(phone.length / 2));
  } else if (phone.length > 15) {
    phone = phone.substring(0, 11);
  }

  if (phone.length === 8)                             phone = '569' + phone;
  else if (phone.length === 9 && phone.startsWith('9')) phone = '56' + phone;
  else if (!phone.startsWith('56') && phone.length > 0) phone = '56' + phone;

  return phone;
}

/**
 * Convierte una fecha con "/" a formato "YYYY-MM-DD".
 */
function normalizarFecha(fecha: string): string {
  if (!fecha.includes('/')) return fecha;
  const parts = fecha.split('/');
  if (parts.length !== 3) return fecha;
  // DD/MM/YYYY → YYYY-MM-DD
  return parts[0].length === 4
    ? `${parts[0]}-${parts[1]}-${parts[2]}`  // YYYY/MM/DD
    : `${parts[2]}-${parts[1]}-${parts[0]}`; // DD/MM/YYYY
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Handshake de verificación de URL de Slack
    if (body.type === 'url_verification') {
      return new Response(body.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    if (body.type === 'event_callback') {
      const event = body.event;

      // Solo procesar mensajes humanos que contengan "SDR:"
      if (event.type === 'message' && !event.bot_id && event.text && /SDR:\s*.+/i.test(event.text)) {
        const texto: string = event.text;

        await addSlackReaction(event.channel, event.ts, 'rocket');

        // ── EXTRACCIÓN DE CAMPOS ────────────────────────────────────────

        // Cliente: viene en la PRIMERA LÍNEA como "Reunión {Cliente}"
        // Ej: "Reunión Edenred Chile" → cliente = "Edenred Chile"
        const primeraLinea = texto.split('\n')[0].trim();
        let cliente: string | null = null;
        const clienteMatch = primeraLinea.match(/^(?:Reuni[oó]n|Reagendamiento|Agendamiento)\s+(.+)/i);
        if (clienteMatch && clienteMatch[1].trim().length > 1) {
          cliente = clienteMatch[1].trim();
        }

        const empresa        = extract(texto, /^Empresa:\s*(.+)/im);
        const nombre         = extract(texto, /^Nombre Contacto:\s*(.+)/im) || 'Prospecto';
        const correosContacto= extract(texto, /^Correos Contacto:\s*(.+)/im);
        const cargo          = extract(texto, /^Cargo:\s*(.+)/im);
        const telefonoRaw    = extract(texto, /^Tel[eé]fono:\s*(.+)/im);
        const diaHoraStr     = extract(texto, /^D[ií]a y Hora:\s*(.+)/im) || '';
        const agendadoPara   = extract(texto, /^Agendado para:\s*(.+)/im);
        const canal          = extract(texto, /^Canal:\s*(.+)/im);
        const sdrName        = extract(texto, /^SDR:\s*(.+)/im);
        const emailOrigen    = extract(texto, /^Desde qu[eé] mail sali[oó] la reuni[oó]n:\s*(.+)/im);

        // Link de Google Meet: captura la URL en la misma línea o línea siguiente
        // Regex tolerante a espacios/saltos antes de la URL
        const linkMeet = extract(texto, /^Link a Google Meet:\s*(https?:\/\/\S+)/im)
          ?? extractMultiline(texto, /Link a Google Meet:\s*\n?\s*(https?:\/\/\S+)/im);

        // Contexto multilínea: captura todo entre "Contexto Reunion:" y el siguiente campo conocido o fin
        const contexto = extractMultiline(
          texto,
          /^Contexto Reunion:\s*\n?([\s\S]+?)(?=\n(?:Link a Google Meet:|SDR:|$))/im
        );

        // ── NORMALIZACIÓN ───────────────────────────────────────────────

        const telefono = normalizarTelefono(telefonoRaw);

        // Parsear fecha y hora desde "YYYY-MM-DD HH:mm:ss" o variantes
        let fecha = new Date().toISOString().split('T')[0];
        let hora  = '10:00:00';

        const dateParts = diaHoraStr.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2}(:\d{2})?)/);
        if (dateParts) {
          fecha = normalizarFecha(dateParts[1]);
          hora  = dateParts[2].length === 5 ? dateParts[2] + ':00' : dateParts[2];
        } else {
          const partes = diaHoraStr.split(/\s+/);
          if (partes.length >= 2) {
            fecha = normalizarFecha(partes[0]);
            hora  = partes[1].substring(0, 5) + ':00';
          }
        }

        // Notas = texto raw completo del ticket del bot (para trazabilidad total)
        const notas = texto.trim();

        // ── ANTI-DUPLICADOS ─────────────────────────────────────────────
        const { data: existingMeeting } = await supabase
          .from('reuniones')
          .select('id, link_meet')
          .eq('nombre_prospecto', nombre)
          .eq('fecha_reunion', fecha)
          .eq('hora_reunion', hora)
          .maybeSingle();

        if (existingMeeting) {
          // Si ya existe pero no tenía link de Meet, actualizarlo
          if (linkMeet && !existingMeeting.link_meet) {
            await supabase
              .from('reuniones')
              .update({ link_meet: linkMeet, notas })
              .eq('id', existingMeeting.id);
            console.log('Reunión existente actualizada con link de Meet.');
            return NextResponse.json({ ok: true, updated: 'link_meet' }, { status: 200 });
          }
          console.log('Reunión duplicada detectada, ignorando...');
          return NextResponse.json({ ok: true, skipped: 'duplicate' }, { status: 200 });
        }

        // ── INSERCIÓN ───────────────────────────────────────────────────
        // Prioridad: si hay teléfono → necesita confirmación WhatsApp
        //            si no hay teléfono → agendado por mail, no necesita WA
        const hayTelefono = !!(telefono && telefono.length > 5);

        const { error } = await supabase.from('reuniones').insert([{
          titulo_reunion:          empresa ? `Reunión con ${empresa}` : primeraLinea,
          email_origen:            emailOrigen,
          empresa:                 empresa,
          nombre_prospecto:        nombre,
          correos_contacto:        correosContacto,
          cargo:                   cargo,
          telefono:                telefono || null,
          fecha_reunion:           fecha,
          hora_reunion:            hora,
          agendado_para:           agendadoPara,
          canal:                   canal,
          notas:                   notas,
          link_meet:               linkMeet,
          sdr_name:                sdrName,
          cliente:                 cliente,
          necesita_confirmacion:   hayTelefono,  // true=WA pendiente, false=mail
        }]);

        if (error) {
          console.error('Error insertando en Supabase:', error);
          await sendSlackConfirmation(event.channel, `❌ Error al guardar a ${nombre}. Error: ${error.message}`, event.ts);
        } else {
          await sendSlackConfirmation(event.channel, `✅ ¡Listo! La reunión con ${nombre} (${empresa ?? 'sin empresa'}) ya está en el Dashboard.`, event.ts);
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error("Error crítico en el Webhook:", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 200 });
  }
}
