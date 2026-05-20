import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhoneNumber, hasValidPhone } from '@/lib/phone';

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

      // Extraer texto del evento (puede venir en text, en attachments, o en blocks)
      let textoRaw = event.text || '';
      if (event.attachments && Array.isArray(event.attachments)) {
        for (const att of event.attachments) {
          if (att.pretext) textoRaw += '\n' + att.pretext;
          if (att.text) textoRaw += '\n' + att.text;
          if (att.fallback) textoRaw += '\n' + att.fallback;
        }
      }
      if (event.blocks && Array.isArray(event.blocks)) {
        for (const block of event.blocks) {
          // Extraer texto de bloques tipo 'section' o 'header'
          if (block.text && block.text.text) {
            textoRaw += '\n' + block.text.text;
          }
        }
      }

      // Procesar mensajes que contengan el formato de reunión.
      // Permitimos mensajes de bots externos (ej: "Avisos Reuniones") pero
      // bloqueamos los del propio SDR Tracker para evitar bucles infinitos.
      const esMiPropioBotRespuesta = event.username === 'SDR Tracker' ||
        /^[✅❌🔄]/.test(textoRaw);

      if (event.type === 'message' && !esMiPropioBotRespuesta && textoRaw && /SDR:\s*.+/i.test(textoRaw)) {
        const texto: string = textoRaw;

        await addSlackReaction(event.channel, event.ts, 'rocket');

        // ── EXTRACCIÓN DE CAMPOS ────────────────────────────────────────

        // 1. Limpiamos links de Slack formato <url|texto> a solo "texto" para evitar 
        // que el "https" reemplace el nombre del cliente.
        let textoLimpio = texto.replace(/<[^|>]+\|([^>]+)>/g, '$1');

        // 2. Buscar la línea del título (Reunión, Reagendamiento, Agendamiento)
        const lineas = textoLimpio.split('\n').map(l => l.trim().replace(/[*_~`]/g, '').trim()).filter(l => l.length > 0);
        let primeraLinea = lineas[0] || '';
        let cliente: string | null = null;
        let esReagendamiento = false;

        for (const linea of lineas) {
          const match = linea.match(/^(?:Reuni[oó]n|Reagendamiento|Agendamiento)\s+(.+)/i);
          if (match) {
            primeraLinea = linea; // Guardar la línea real como título
            cliente = match[1].trim();
            // Limpiar si quedó un link <url> sin texto
            cliente = cliente.replace(/^<|>$/g, '').trim();
            esReagendamiento = /^Reagendamiento/i.test(linea);
            break;
          }
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

        // Link de Google Meet: busca SOLO el formato real de Google Meet
        // (meet.google.com/xxx-xxxx-xxx) ignorando el texto de preview que
        // Slack concatena sin espacio después de la URL.
        const meetUrlMatch = texto.match(/https?:\/\/meet\.google\.com\/[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/i);
        const linkMeet = meetUrlMatch ? meetUrlMatch[0] : null;

        // Contexto multilínea: acepta espacio opcional antes del colon ("Contexto Reunion :")
        const contexto = extractMultiline(
          texto,
          /^Contexto Reunion\s*:\s*\n?([\s\S]+?)(?=\n(?:Link a Google Meet:|SDR:|$))/im
        );

        // ── NORMALIZACIÓN ───────────────────────────────────────────────

        const telefono = normalizePhoneNumber(telefonoRaw);

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

        // Prioridad: si hay teléfono → necesita confirmación WhatsApp
        //            si no hay teléfono → agendado por mail, no necesita WA
        const hayTelefono = hasValidPhone(telefono);

        // ── DETECTAR REAGENDAMIENTO ──────────────────────────────────────
        // esReagendamiento ya fue evaluado en el paso 2 de extracción

        if (esReagendamiento) {
          // Buscar la reunión existente por nombre del prospecto (independiente de fecha/hora)
          const { data: reunionExistente } = await supabase
            .from('reuniones')
            .select('id')
            .eq('nombre_prospecto', nombre)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (reunionExistente) {
            // ── ACTUALIZAR reunión existente con nueva fecha/hora y resetear estados ──
            const { error: updateErr } = await supabase
              .from('reuniones')
              .update({
                fecha_reunion:        fecha,
                hora_reunion:         hora,
                link_meet:            linkMeet,
                notas:                notas,
                agendado_para:        agendadoPara,
                canal:                canal,
                // Resetear estados de seguimiento para el nuevo agendamiento
                estado_post_llamada:  'pendiente',
                estado_24h:           'pendiente',
                estado_1h:            'pendiente',
                necesita_confirmacion: hayTelefono,
              })
              .eq('id', reunionExistente.id);

            if (updateErr) {
              console.error('Error actualizando reagendamiento:', updateErr);
              await sendSlackConfirmation(event.channel, `❌ Error al reagendar a ${nombre}. Error: ${updateErr.message}`, event.ts);
            } else {
              await sendSlackConfirmation(event.channel, `🔄 ¡Reagendamiento aplicado! La reunión con ${nombre} fue actualizada al ${fecha} ${hora}.`, event.ts);
            }
            return NextResponse.json({ ok: true, updated: 'reagendamiento' }, { status: 200 });
          }
          // Si no existe la reunión previa, caer al flujo normal de inserción
          console.log('Reagendamiento sin reunión previa encontrada, insertando como nueva...');
        }

        // ── ANTI-DUPLICADOS (para agendamientos nuevos) ──────────────────
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
          necesita_confirmacion:   hayTelefono,
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
