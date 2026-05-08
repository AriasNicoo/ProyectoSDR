'use client'

import type { Toast } from '@/hooks/useToast'

interface ToastContainerProps {
  toasts: Toast[]
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} role="alert">
          <span>{t.type === 'success' ? '✅' : '❌'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
