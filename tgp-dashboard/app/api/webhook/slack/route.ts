import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Función para añadir una reacción de emoji a un mensaje en Slack
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
 * Envía un mensaje de confirmación de vuelta al canal de Slack
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
        thread_ts: threadTs // Responde en hilo para mantener limpio el canal principal
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

    // 2. Procesamiento de eventos de Slack
    if (body.type === 'event_callback') {
      const event = body.event;

      // Filtro estricto: Solo procesar mensajes que contengan la clave SDR
      if (
        event.type === 'message' &&
        !event.bot_id &&
        event.text &&
        event.text.includes('SDR: Nicolas Arias')
      ) {
        const texto = event.text;

        // Feedback Visual Inmediato (Reacción de check al mensaje original)
        await addSlackReaction(event.channel, event.ts, 'white_check_mark');

        // --- Lógica del Parser (Regex Power) ---
        const nombreMatch = texto.match(/Nombre Contacto:\s*(.+)/i);
        const telMatch = texto.match(/Tel[eé]fono:\s*(.+)/i);
        const diaHoraMatch = texto.match(/D[ií]a y Hora:\s*(.+)/i);
        const empresaMatch = texto.match(/Empresa:\s*(.+)/i);
        // Usamos [^]* o [\s\S]* para capturar todo el contexto incluso con saltos de línea
        const contextoMatch = texto.match(/Contexto Reunion:\s*([\s\S]+)/i);

        const nombre = nombreMatch ? nombreMatch[1].trim() : 'Prospecto Sin Nombre';
        let telefono = telMatch ? telMatch[1].trim() : '';
        const diaHoraStr = diaHoraMatch ? diaHoraMatch[1].trim() : '';
        const empresa = empresaMatch ? empresaMatch[1].trim() : 'Desconocida';
        const contexto = contextoMatch ? contextoMatch[1].trim() : '';

        // --- Procesamiento de Teléfono (Formato Chileno 569) ---
        telefono = telefono.replace(/\D/g, ''); // Deja solo números
        if (telefono.length === 8) {
          telefono = '569' + telefono;
        } else if (telefono.length === 9 && telefono.startsWith('9')) {
          telefono = '56' + telefono;
        } else if (telefono.length === 11 && telefono.startsWith('569')) {
          // Formato perfecto
        } else if (!telefono.startsWith('56') && telefono.length > 0) {
          // Fallback
          telefono = '56' + telefono;
        }

        // --- Procesamiento de Fecha y Hora ---
        let fecha = '';
        let hora = '10:00';
        
        // Intentar extraer 'YYYY-MM-DD HH:mm' o similar
        const dateParts = diaHoraStr.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2})/);
        
        if (dateParts) {
          fecha = dateParts[1];
          hora = dateParts[2];
        } else {
          // Fallback simple si no viene todo junto pero hay un espacio
          const partes = diaHoraStr.split(/\s+/);
          if (partes.length >= 2) {
            fecha = partes[0];
            hora = partes[1].substring(0, 5); // Asegura "HH:mm"
          } else if (partes.length === 1) {
            fecha = partes[0];
          }
        }

        if (fecha.includes('/')) {
          const [dia, mes, anio] = fecha.split('/');
          fecha = `${anio}-${mes}-${dia}`;
        } else if (!fecha) {
          fecha = new Date().toISOString().split('T')[0]; // Hoy por defecto
        }

        // ISO para Supabase "YYYY-MM-DDTHH:mm:00"
        const fechaISO = `${fecha}T${hora.padStart(5, '0')}:00`;
        
        // Empacar la Empresa y Contexto en el campo notas
        const notasFinales = `Empresa: ${empresa}\nContexto: ${contexto}`;

        // --- Integración con Supabase ---
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
            `❌ Error al guardar a ${nombre} en Supabase.`, 
            event.ts
          );
        } else {
          console.log(`✅ Reunión creada vía Slack para: ${nombre}`);
          await sendSlackConfirmation(
            event.channel, 
            `✅ Ticket procesado: ${nombre} de ${empresa} ha sido agregado al Dashboard de Nicolás.`,
            event.ts
          );
        }
      }
    }

    // 3. Respuesta obligatoria 200 OK a Slack (para que no reintente)
    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error("Error crítico en el Webhook:", error);
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 200 });
  }
}
