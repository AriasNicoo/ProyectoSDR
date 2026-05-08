import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Challenge Handler para mantener la conexión viva con Slack
    if (body.type === 'url_verification') {
      return new Response(body.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 2. Procesamiento de eventos de Slack
    if (body.type === 'event_callback') {
      const event = body.event;

      // Filtro estricto: Solo procesar mensajes reales que contengan la clave
      if (
        event.type === 'message' &&
        !event.bot_id &&
        event.text &&
        event.text.includes('SDR: Nicolas Arias')
      ) {
        const texto = event.text;

        // --- Lógica del Parser (Regex Power) ---
        const nombreMatch = texto.match(/Nombre:\s*(.+)/i);
        const telMatch = texto.match(/Tel[eé]fono:\s*(.+)/i);
        const fechaMatch = texto.match(/Fecha:\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
        const horaMatch = texto.match(/Hora:\s*(\d{1,2}:\d{2})/i);
        const meetMatch = texto.match(/(https?:\/\/(?:meet\.google\.com|zoom\.us)[^\s]+)/i);

        const nombre = nombreMatch ? nombreMatch[1].trim() : 'Prospecto Sin Nombre';
        let telefono = telMatch ? telMatch[1].trim() : '';
        let fecha = fechaMatch ? fechaMatch[1] : '';
        const hora = horaMatch ? horaMatch[1] : '10:00';
        const linkMeet = meetMatch ? meetMatch[1] : '';

        // --- Procesamiento de Teléfono (Formato Chileno 569) ---
        telefono = telefono.replace(/\D/g, ''); // Deja solo números
        if (telefono.length === 8) {
          telefono = '569' + telefono;
        } else if (telefono.length === 9 && telefono.startsWith('9')) {
          telefono = '56' + telefono;
        } else if (telefono.length === 11 && telefono.startsWith('569')) {
          // Formato perfecto, no se altera
        } else if (!telefono.startsWith('56') && telefono.length > 0) {
          // Fallback de seguridad
          telefono = '56' + telefono;
        }

        // --- Procesamiento de Fecha y Hora ---
        if (fecha.includes('/')) {
          const [dia, mes, anio] = fecha.split('/');
          fecha = `${anio}-${mes}-${dia}`;
        } else if (!fecha) {
          fecha = new Date().toISOString().split('T')[0]; // Hoy como fallback
        }

        // ISO exacto para Supabase: "YYYY-MM-DDTHH:mm:00"
        const fechaISO = `${fecha}T${hora.padStart(5, '0')}:00`;
        const notasFinales = linkMeet ? `Enlace reunión: ${linkMeet}` : null;

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
        } else {
          console.log(`✅ Reunión creada vía Slack para: ${nombre}`);
        }
      }
    }

    // 3. Respuesta obligatoria 200 OK a Slack (para que no reintente)
    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error("Error crítico en el Webhook:", error);
    // Slack reintenta si enviamos 500. Retornamos 200 OK con un flag de error interno.
    return NextResponse.json({ ok: false, error: "Internal Parsing Error" }, { status: 200 });
  }
}
