import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Añade una reacción (emoji) a un mensaje específico en Slack
 */
async function addSlackReaction(channelId: string, timestamp: string, emoji: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  
  try {
    await fetch('https://slack.com/api/reactions.add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        channel: channelId,
        name: emoji,
        timestamp: timestamp
      })
    });
  } catch (error) {
    console.error("Error añadiendo reacción en Slack:", error);
  }
}

/**
 * Envía un mensaje a Slack (opcionalmente en un hilo)
 */
async function sendSlackConfirmation(channelId: string, text: string, threadTs?: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        channel: channelId,
        text: text,
        thread_ts: threadTs
      })
    });
  } catch (error) {
    console.error("Error enviando mensaje a Slack:", error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Challenge Handler
    if (body.type === 'url_verification') {
      return new Response(body.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 2. Procesamiento de Eventos
    if (body.type === 'event_callback') {
      const event = body.event;

      // Filtro principal: Solo SDR Nicolas Arias
      if (
        event.type === 'message' &&
        !event.bot_id &&
        event.text &&
        event.text.includes('SDR: Nicolas Arias')
      ) {
        const texto = event.text;

        // Feedback Visual Inmediato (🚀 rocket emoji)
        await addSlackReaction(event.channel, event.ts, 'rocket');

        // --- Lógica del Parser Especial (Edenred) ---
        const nombreMatch = texto.match(/Nombre Contacto:\s*(.+)/i);
        const empresaMatch = texto.match(/Empresa:\s*(.+)/i);
        const telMatch = texto.match(/Tel[eé]fono:\s*(.+)/i);
        const diaHoraMatch = texto.match(/D[ií]a y Hora:\s*(.+)/i);
        const contextoMatch = texto.match(/Contexto Reunion:\s*([\s\S]+)/i);

        const nombre = nombreMatch ? nombreMatch[1].trim() : 'Prospecto Sin Nombre';
        const empresa = empresaMatch ? empresaMatch[1].trim() : 'Desconocida';
        let telefono = telMatch ? telMatch[1].trim() : '';
        const diaHoraStr = diaHoraMatch ? diaHoraMatch[1].trim() : '';
        const contexto = contextoMatch ? contextoMatch[1].trim() : '';

        // Limpieza Teléfono Chileno (569)
        telefono = telefono.replace(/\D/g, ''); 
        if (telefono.length === 8) {
          telefono = '569' + telefono;
        } else if (telefono.length === 9 && telefono.startsWith('9')) {
          telefono = '56' + telefono;
        } else if (!telefono.startsWith('56') && telefono.length > 0) {
          telefono = '56' + telefono;
        }

        // Extracción de Fecha (YYYY-MM-DD) y Hora (HH:mm)
        let fecha = '';
        let hora = '10:00';
        
        const dateParts = diaHoraStr.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2})/);
        if (dateParts) {
          fecha = dateParts[1];
          hora = dateParts[2];
        } else {
          const partes = diaHoraStr.split(/\s+/);
          if (partes.length >= 2) {
            fecha = partes[0];
            hora = partes[1].substring(0, 5);
          } else if (partes.length === 1) {
            fecha = partes[0];
          }
        }

        if (fecha.includes('/')) {
          const [dia, mes, anio] = fecha.split('/');
          fecha = `${anio}-${mes}-${dia}`;
        } else if (!fecha) {
          fecha = new Date().toISOString().split('T')[0];
        }

        const fechaISO = `${fecha}T${hora.padStart(5, '0')}:00`;
        const notasFinales = `Empresa: ${empresa} | Contexto: ${contexto}`;

        // --- Inserción en Supabase ---
        const { error } = await supabase.from('reuniones').insert([{
          nombre_prospecto: nombre,
          telefono: telefono,
          fecha_reunion: fechaISO,
          hora_reunion: hora,
          notas: notasFinales,
          estado_post_llamada: 'pendiente',
          estado_24h: 'pendiente',
          estado_1h: 'pendiente',
        }]);

        if (error) {
          console.error('Error insertando en Supabase:', error);
          await sendSlackConfirmation(
            event.channel, 
            `❌ Error guardando a *${nombre}* de ${empresa}. Revisa los logs.`, 
            event.ts
          );
        } else {
          console.log(`✅ Reunión Edenred creada para: ${nombre}`);
          await sendSlackConfirmation(
            event.channel, 
            `✅ Nicolás, ya agendé a *${nombre}* de ${empresa} en tu Dashboard.`,
            event.ts
          );
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error("Error crítico en el Webhook:", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 200 });
  }
}
