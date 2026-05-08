import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Respuesta ultra rápida para el challenge
    if (body && body.type === 'url_verification') {
      return new Response(body.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Si falla el parsing del JSON, retornamos OK de todas formas para que Slack no reintente
    return NextResponse.json({ ok: true });
  }
}

// Agregamos GET para probar manualmente desde el navegador
export async function GET() {
  return new Response("El endpoint está vivo", { status: 200 });
}
