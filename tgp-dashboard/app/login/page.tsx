import { signInWithGoogle } from '@/lib/actions/auth'
import { LogIn } from 'lucide-react'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // In dynamic pages this component is dynamic
  const error = searchParams.error

  let mensajeError = ''
  if (error === 'dominio_no_permitido') {
    mensajeError = 'Acceso denegado. Solo se permiten correos @thegrowth.pro'
  } else if (error === 'auth_failed' || error === 'oauth_error') {
    mensajeError = 'Error de autenticación. Inténtalo nuevamente.'
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top right, #16181c 0%, #0c0e10 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#fff',
        padding: '20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'rgba(25, 28, 33, 0.7)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          padding: '40px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          animation: 'fadeIn 0.5s ease'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #20242a 0%, #15181d 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            marginBottom: '24px'
          }}
        >
          <LogIn size={28} style={{ color: 'var(--accent-green, #2ea043)' }} />
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.5px' }}>
          SDR TRACKER
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '32px' }}>
          Ingresa con tu cuenta corporativa
        </p>

        {mensajeError && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              padding: '12px',
              borderRadius: '12px',
              fontSize: '13px',
              marginBottom: '24px',
              animation: 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both'
            }}
          >
            ⚠ {mensajeError}
          </div>
        )}

        <form action={signInWithGoogle}>
          <button
            type="submit"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              backgroundColor: '#fff',
              color: '#000',
              border: 'none',
              height: '48px',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, opacity 0.2s ease',
              boxShadow: '0 4px 12px rgba(255,255,255,0.1)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuar con Google
          </button>
        </form>

        <div style={{ marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
            Uso restringido para dominio <b>@thegrowth.pro</b>
          </p>
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-2px, 0, 0); }
            40%, 60% { transform: translate3d(2px, 0, 0); }
          }
        `}</style>
      </div>
    </div>
  )
}
