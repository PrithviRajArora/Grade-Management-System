/**
 * Skeleton loader — drop-in replacement for loading spinners.
 * Usage:
 *   <Skeleton />                  — single line
 *   <Skeleton width="60%" />      — shorter line
 *   <Skeleton height={120} />     — taller block
 *   <SkeletonTable rows={5} cols={4} />
 *   <SkeletonCard />
 */

const pulse = `
  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1 }
    50%       { opacity: 0.4 }
  }
`

function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <>
      <style>{pulse}</style>
      <div style={{
        width, height,
        borderRadius: radius,
        background: 'var(--border2)',
        animation: 'skeleton-pulse 1.6s ease-in-out infinite',
        ...style,
      }} />
    </>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  const widths = ['40%', '60%', '30%', '50%', '45%', '70%', '35%']
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12, padding: '10px 14px',
        background: 'var(--surface2)',
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width="50%" height={11} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 12, padding: '13px 14px',
          borderTop: '1px solid var(--border)',
        }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={widths[(r * cols + c) % widths.length]} height={13} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton width="45%" height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={13} />
      ))}
    </div>
  )
}

export function SkeletonStatGrid({ count = 4 }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <Skeleton width="55%" height={11} style={{ marginBottom: 10 }} />
          <Skeleton width="40%" height={32} />
        </div>
      ))}
    </div>
  )
}

export default Skeleton
