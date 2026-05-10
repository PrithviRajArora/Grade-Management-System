import { useEffect } from 'react'

export default function Modal({ title, onClose, children, width = 480 }) {
  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 16,
        width: '100%', maxWidth: width,
        boxShadow: 'var(--shadow-lg)',
        animation: 'slideUp 0.2s ease',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: 'var(--text3)', cursor: 'pointer',
            fontSize: 20, lineHeight: 1, padding: 4,
          }}>×</button>
        </div>
        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  )
}
