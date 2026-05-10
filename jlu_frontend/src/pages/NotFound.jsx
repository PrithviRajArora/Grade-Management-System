import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: 16, padding: 24,
    }}>
      <div style={{
        fontSize: 96, fontWeight: 800, color: 'var(--border2)',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>404</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Page not found</div>
      <div style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', maxWidth: 320 }}>
        The page you're looking for doesn't exist or you don't have permission to view it.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Go Back</button>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
      </div>
    </div>
  )
}
