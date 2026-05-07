import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TGP Dashboard — Seguimiento de Reuniones',
  description: 'Gestiona el seguimiento de reuniones y mensajes de WhatsApp para tus prospectos TGP.',
  keywords: ['CRM', 'reuniones', 'WhatsApp', 'seguimiento', 'prospectos'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <div className="app-wrapper">
          {children}
        </div>
      </body>
    </html>
  )
}
