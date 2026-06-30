import { supabaseAdmin } from '@/lib/supabase';
import { 
  Mail, 
  Phone, 
  Calendar, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Users, 
  FileText, 
  Clock, 
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';

// Helper to format date into friendly Spanish format
function formatFriendlyDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (e) {
    return dateStr;
  }
}

// Generate the WhatsApp confirmation link
function getWhatsAppLink(telefono: string, contacto: string, fechaHora: string, sdr: string, linkMeet: string) {
  const cleanPhone = telefono.replace(/[^\d+]/g, '');
  
  let formattedDate = fechaHora;
  try {
    const date = new Date(fechaHora);
    formattedDate = date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) + ' hrs';
  } catch (e) {}

  const message = `Hola ${contacto}, te escribo para confirmar nuestra reunión de mañana a las ${formattedDate} con ${sdr}. ¡Nos vemos! Link: ${linkMeet || 'Se enviará por correo'}`;
  
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export const revalidate = 0; // Disable cache so the dashboard always has live data

interface PageProps {
  searchParams: Promise<{
    auth_status?: string;
    connected_email?: string;
    message?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const authStatus = params.auth_status;
  const connectedEmail = params.connected_email;
  const authMessage = params.message;

  // 1. Get current week date range (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // 2. Fetch data from Supabase
  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('oauth_tokens')
    .select('*')
    .order('email', { ascending: true });

  const { data: reuniones, error: reunionesError } = await supabaseAdmin
    .from('reuniones')
    .select('*')
    .gte('fecha_hora', startOfWeek.toISOString())
    .lte('fecha_hora', endOfWeek.toISOString())
    .order('fecha_hora', { ascending: true });

  const totalReuniones = reuniones?.length || 0;
  const totalBandejas = accounts?.length || 0;

  // Count channels
  const llamadasCount = reuniones?.filter(r => r.canal === 'llamada').length || 0;
  const mailsCount = reuniones?.filter(r => r.canal === 'mail').length || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white pb-12">
      
      {/* Top Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-indigo-50 to-purple-200">
                SDR Automation Hub
              </span>
              <span className="block text-xs text-slate-500 font-medium">Control de Bandejas y Reuniones</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sincronizado
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 mt-8 relative z-10">
        
        {/* Auth Status Notification Banner */}
        {authStatus === 'success' && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/30 text-emerald-300 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Bandeja conectada correctamente</p>
              <p className="text-xs text-emerald-400/80">La cuenta <strong className="text-emerald-200">{connectedEmail}</strong> se ha vinculado y está activa para el envío y lectura de correos.</p>
            </div>
          </div>
        )}

        {authStatus === 'error' && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-950/30 text-rose-300 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Error en la vinculación de cuenta</p>
              <p className="text-xs text-rose-400/80">{authMessage || 'No se pudo completar el flujo de autorización de Google.'}</p>
            </div>
          </div>
        )}

        {/* Dashboard Title & Quick Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Dashboard SDR</h1>
            <p className="text-slate-400 text-sm mt-1">Revisión de reuniones agendadas esta semana y estado de integración.</p>
          </div>
          <div className="text-xs text-slate-500 bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
            <span className="font-semibold text-slate-300">Semana actual:</span> {startOfWeek.toLocaleDateString('es-ES')} - {endOfWeek.toLocaleDateString('es-ES')}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Reuniones de la Semana</span>
              <span className="text-3xl font-bold text-white mt-1 block">{totalReuniones}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Bandejas Clientes</span>
              <span className="text-3xl font-bold text-white mt-1 block">{totalBandejas}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Originadas por Llamada</span>
              <span className="text-3xl font-bold text-white mt-1 block">{llamadasCount}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Phone className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Originadas por Mail</span>
              <span className="text-3xl font-bold text-white mt-1 block">{mailsCount}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Mail className="w-6 h-6" />
            </div>
          </div>

        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Table Container (Reuniones) */}
          <div className="lg:col-span-2 bg-slate-900/40 border border-slate-900 rounded-2xl backdrop-blur-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-900 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-white">Reuniones de esta Semana</h3>
                <p className="text-xs text-slate-500">Listado de prospectos agendados automáticamente.</p>
              </div>
            </div>

            {reunionesError ? (
              <div className="p-8 text-center text-slate-500">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                <p>Error cargando las reuniones desde la base de datos.</p>
                <p className="text-xs text-slate-600 mt-1">{reunionesError.message}</p>
              </div>
            ) : !reuniones || reuniones.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="font-medium text-slate-400">No hay reuniones agendadas para esta semana</p>
                <p className="text-xs text-slate-600 mt-1">Los agendamientos desde llamadas y correos aparecerán aquí automáticamente.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Fecha / Hora</th>
                      <th className="px-6 py-4">Cliente / Contacto</th>
                      <th className="px-6 py-4">Origen</th>
                      <th className="px-6 py-4 text-right">Confirmación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {reuniones.map((reunion) => {
                      const waLink = getWhatsAppLink(
                        reunion.telefono,
                        reunion.nombre_contacto,
                        reunion.fecha_hora,
                        reunion.sdr_asignado,
                        reunion.link_meet
                      );
                      
                      return (
                        <tr key={reunion.id} className="hover:bg-slate-900/20 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="block font-semibold text-white text-sm">
                              {formatFriendlyDate(reunion.fecha_hora)}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                              SDR: {reunion.sdr_asignado}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="block font-semibold text-slate-200 text-sm">
                              {reunion.nombre_contacto}
                            </span>
                            <span className="block text-xs text-indigo-400/90 font-medium">
                              {reunion.empresa}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              reunion.canal === 'mail' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                            }`}>
                              {reunion.canal === 'mail' ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                              {reunion.canal === 'mail' ? 'Hilo Mail' : 'Llamada'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all duration-200 font-medium hover:scale-[1.02] shadow-md shadow-emerald-500/15"
                            >
                              <MessageSquare className="w-3.5 h-3.5 fill-slate-950" />
                              Aviso 24hrs
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar (Connected accounts / Inboxes) */}
          <div className="flex flex-col gap-6">
            
            {/* Account List Card */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg text-white">Bandejas Activas</h3>
                  <p className="text-xs text-slate-500">Cuentas con acceso offline a Gmail.</p>
                </div>
                <Link
                  href="/api/auth/google"
                  className="w-8 h-8 rounded-lg bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center text-white transition-all hover:scale-105 shadow-md shadow-indigo-500/10"
                  title="Conectar Nueva Bandeja"
                >
                  <Plus className="w-4 h-4" />
                </Link>
              </div>

              {accountsError ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  <AlertTriangle className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                  <p>Error de carga de cuentas.</p>
                </div>
              ) : !accounts || accounts.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl">
                  <Mail className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Ninguna bandeja conectada</p>
                  <p className="text-[10px] text-slate-600 mt-1">Haz clic en el botón '+' para conectar la primera bandeja de Gmail.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {accounts.map((acc) => (
                    <div 
                      key={acc.id} 
                      className="bg-slate-950/50 border border-slate-900 rounded-xl p-3.5 flex items-center justify-between hover:border-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden">
                          <span className="block text-xs font-semibold text-slate-200 truncate">{acc.email}</span>
                          <span className="block text-[10px] text-slate-500">Google Workspace API</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-emerald-950 shadow-sm shadow-emerald-500/50" />
                        <span className="text-[10px] text-emerald-400 font-medium">Activa</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick API endpoints summary card for SDR */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 backdrop-blur-md">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-4">Endpoints de Automatización</h4>
              
              <div className="flex flex-col gap-4 text-xs">
                
                <div className="space-y-1">
                  <span className="text-indigo-400 font-mono text-[10px] uppercase">Slack Webhook</span>
                  <div className="bg-slate-950 border border-slate-900 px-3 py-2 rounded-lg font-mono text-slate-400 select-all overflow-x-auto text-[11px] whitespace-nowrap">
                    POST /api/slack/webhook
                  </div>
                  <span className="block text-[10px] text-slate-500">Recibe resúmenes de llamadas/mails y gatilla email.</span>
                </div>

                <div className="space-y-1">
                  <span className="text-purple-400 font-mono text-[10px] uppercase">Cron: Pushes de Seguimiento</span>
                  <div className="bg-slate-950 border border-slate-900 px-3 py-2 rounded-lg font-mono text-slate-400 text-[11px] whitespace-nowrap">
                    GET /api/cron/pushes
                  </div>
                  <span className="block text-[10px] text-slate-500">Ejecuta pushes lunes y miércoles.</span>
                </div>

                <div className="space-y-1">
                  <span className="text-pink-400 font-mono text-[10px] uppercase">Cron: Triaje Inbound</span>
                  <div className="bg-slate-950 border border-slate-900 px-3 py-2 rounded-lg font-mono text-slate-400 text-[11px] whitespace-nowrap">
                    GET /api/cron/triage
                  </div>
                  <span className="block text-[10px] text-slate-500">Revisa y clasifica respuestas entrantes con LLM.</span>
                </div>

              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
