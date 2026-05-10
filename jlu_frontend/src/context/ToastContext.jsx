import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x))
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 300)
  }, [])

  const toast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++_id
    setToasts(t => [...t, { id, message, type, leaving: false }])
    timers.current[id] = setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  // Convenience helpers
  toast.success = (msg, dur) => toast(msg, 'success', dur)
  toast.error = (msg, dur) => toast(msg, 'error', dur ?? 6000)
  toast.info = (msg, dur) => toast(msg, 'info', dur)
  toast.warn = (msg, dur) => toast(msg, 'warn', dur)

  const typeStyles = {
    success: { border: 'rgba(95,184,154,0.4)', color: '#5fb89a', symbol: '✓' },
    error: { border: 'rgba(217,96,90,0.4)', color: '#d9605a', symbol: '✕' },
    warn: { border: 'rgba(179,175,143,0.4)', color: '#b3af8f', symbol: '⚠' },
    info: { border: 'rgba(110,168,212,0.4)', color: '#6ea8d4', symbol: 'ℹ' },
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const s = typeStyles[t.type] ?? typeStyles.success
          return (
            <div key={t.id} onClick={() => dismiss(t.id)}
              style={{
                pointerEvents: 'all',
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'rgba(27,38,59,0.97)',
                border: `1px solid ${s.border}`,
                borderRadius: 10,
                padding: '13px 16px',
                minWidth: 280, maxWidth: 380,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                cursor: 'pointer',
                transform: t.leaving ? 'translateX(120%)' : 'translateX(0)',
                opacity: t.leaving ? 0 : 1,
                transition: 'transform 0.3s ease, opacity 0.3s ease',
                backdropFilter: 'blur(8px)',
              }}>
              <span style={{ fontSize: 15, flexShrink: 0, color: s.color, marginTop: 1 }}>
                {s.symbol}
              </span>
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: s.color, flex: 1 }}>
                {t.message}
              </span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
