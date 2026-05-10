import { actualizarPerfilSDR } from '@/lib/actions/perfil'
import { UserRound } from 'lucide-react'

export default function CompletarPerfilPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top left, #0f172a 0%, #020617 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#fff',
        padding: '20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '450px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#38bdf8'
            }}
          >
            <UserRound size={28} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Configurar tu Perfil</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: 1.5 }}>
            Ingresa tu nombre para sincronizar el dashboard con los tickets de Slack.
          </p>
        </div>

        <form action={actualizarPerfilSDR} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="nombre" style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
              Primer Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              placeholder="Ej: Nicolas"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '12px 16px',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '15px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="apellido" style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
              Primer Apellido
            </label>
            <input
              id="apellido"
              name="apellido"
              type="text"
              required
              placeholder="Ej: Arias"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '12px 16px',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '15px',
                outline: 'none'
              }}
            />
          </div>

          <div 
            style={{ 
              backgroundColor: 'rgba(56, 189, 248, 0.05)', 
              border: '1px dashed rgba(56, 189, 248, 0.2)', 
              padding: '12px', 
              borderRadius: '8px', 
              fontSize: '12px', 
              color: '#38bdf8' 
            }}
          >
            💡 Importante: Escribe los nombres idéntico a como se escriben en tus reuniones agendadas.
          </div>

          <button
            type="submit"
            style={{
              marginTop: '8px',
              height: '48px',
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              fontWeight: 600,
              fontSize: '15px',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Comenzar
          </button>
        </form>
      </div>
    </div>
  )
}
