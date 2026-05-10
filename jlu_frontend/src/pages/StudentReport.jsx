import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analytics, examAttempts as attApi, backlogs as backlogApi } from '../api'
import { useAuth } from '../context/AuthContext'

const GRADE_COLORS = {
  O: '#ffd700', 'A+': '#22d3a0', A: '#4a9eff',
  'B+': '#a78bfa', B: '#f5a623', C: '#f05365', F: '#ff4444', 'N/A': '#4d607f',
}
const PASS_STATUS_BADGE = {
  Pass:       { cls: 'badge-green', icon: '✓' },
  Fail:       { cls: 'badge-red',   icon: '✕' },
  Incomplete: { cls: 'badge-gray',  icon: '…' },
  Pending:    { cls: 'badge-gray',  icon: '…' },
  Withheld:   { cls: 'badge-amber', icon: '⚑' },
}
const ATT_STATUS_BADGE = {
  Pass:'badge-green', Fail:'badge-red', Absent:'badge-amber',
  Scheduled:'badge-gray', Appeared:'badge-blue', Withheld:'badge-amber',
}
const ATT_TYPE_COLOR = {
  Regular:'var(--blue)', Makeup:'var(--amber)',
  Backlog:'var(--red)', SpecialBacklog:'var(--red)',
}

export default function StudentReport() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const [data, setData]                   = useState(null)
  const [attempts, setAttempts]           = useState([])
  const [backlogSummary, setBacklogSummary] = useState(null)
  const [activeBacklogs, setActiveBacklogs] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [expandedCourse, setExpandedCourse] = useState(null)

  const studentId = id ?? (user?.role === 'student' ? user?.profile_id : null)

  useEffect(() => {
    if (!studentId) return
    Promise.all([
      analytics.studentReport(studentId),
      attApi.studentHistory(studentId),
      backlogApi.summary({ student: studentId }),
      backlogApi.list({ student: studentId, status: 'Active' }),
    ])
      .then(([rRes, aRes, bsRes, baRes]) => {
        setData(rRes.data)
        setAttempts(aRes.data)
        setBacklogSummary(bsRes.data)
        setActiveBacklogs(baRes.data.results ?? baRes.data)
      })
      .catch(e => setError(e.response?.data?.detail || 'Report not found.'))
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) return <div className="loading"><div className="spinner" /> Loading report…</div>
  if (error)   return <div className="alert alert-error">{error}</div>
  if (!data)   return null

  const attByCode = {}
  for (const grp of attempts) attByCode[grp.course] = grp.attempts

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {user?.role !== 'student' && (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/students')}>← Back</button>
        )}
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.name}</div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 2 }}>
            <span className="text-mono">{data.roll_no}</span> · {data.program} · {data.school} · Sem {data.semester} · {data.academic_year}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="stat-grid mb-24">
        <div className="stat-card"><div className="stat-label">Courses Enrolled</div><div className="stat-value">{data.summary.courses_enrolled}</div></div>
        <div className="stat-card green"><div className="stat-label">Courses Passed</div><div className="stat-value">{data.summary.courses_completed}</div></div>
        <div className="stat-card blue">
          <div className="stat-label">Avg Grand Total</div>
          <div className="stat-value" style={{ fontSize: 22, marginTop: 8 }}>{data.summary.avg_grand_total ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Best Grade</div>
          <div className="stat-value" style={{ fontSize: 24, marginTop: 8, color: GRADE_COLORS[data.summary.highest_grade] || 'var(--text)' }}>
            {data.summary.highest_grade ?? '—'}
          </div>
        </div>
        {backlogSummary && (
          <>
            <div className={`stat-card ${backlogSummary.active > 0 ? 'red' : ''}`}>
              <div className="stat-label">Active Backlogs</div>
              <div className="stat-value">{backlogSummary.active}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Cleared Backlogs</div>
              <div className="stat-value">{backlogSummary.cleared}</div>
            </div>
          </>
        )}
      </div>

      {/* Active backlog alert */}
      {activeBacklogs.length > 0 && (
        <div style={{ background:'var(--red-dim)', border:'1px solid var(--red)', borderRadius:10, padding:'12px 18px', marginBottom:24, display:'flex', gap:12 }}>
          <span style={{ fontSize:18 }}>⚑</span>
          <div>
            <div style={{ fontWeight:700, marginBottom:4 }}>{activeBacklogs.length} Active Backlog{activeBacklogs.length > 1 ? 's' : ''}</div>
            <div style={{ fontSize:13, color:'var(--text2)' }}>
              {activeBacklogs.map(b => (
                <span key={b.id} style={{ marginRight:10 }}>
                  <span className="badge badge-amber text-mono">{b.course}</span> <span style={{ fontSize:11 }}>({b.reason})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Per-course cards */}
      {data.courses.map(c => {
        const courseAttempts = attByCode[c.course_code] || []
        const ps = c.pass_status || 'Incomplete'
        const psBadge = PASS_STATUS_BADGE[ps] || PASS_STATUS_BADGE.Incomplete
        const isExpanded = expandedCourse === c.course_code

        return (
          <div className="card mb-24" key={c.course_code}>
            <div className="card-header" style={{ flexWrap:'wrap', gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span className="text-mono" style={{ color:'var(--accent)', fontWeight:700 }}>{c.course_code}</span>
                  <span className="badge badge-blue">{c.course_type}</span>
                  <span className="badge badge-gray">Sem {c.semester}</span>
                  <span className="badge badge-gray">{c.credits} cr</span>
                  <span className={`badge ${psBadge.cls}`}>{psBadge.icon} {ps}</span>
                </div>
                <div style={{ fontWeight:600, marginTop:4 }}>{c.course_name}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Faculty: {c.faculty}</div>
              </div>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1 }}>Grand Total</div>
                  <div style={{ fontSize:22, fontWeight:800, color: c.grand_total != null ? 'var(--text)' : 'var(--text3)' }}>{c.grand_total ?? '—'}</div>
                </div>
                <div style={{ width:48, height:48, borderRadius:8, background: GRADE_COLORS[c.grade] ? GRADE_COLORS[c.grade]+'25' : 'var(--surface2)', border:`2px solid ${GRADE_COLORS[c.grade]||'var(--border2)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:GRADE_COLORS[c.grade]||'var(--text3)' }}>
                  {c.grade}
                </div>
              </div>
            </div>

            {c.grand_total != null && (
              <div style={{ marginBottom:16 }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width:`${c.grand_total}%`, background:GRADE_COLORS[c.grade]||'var(--accent)' }} />
                </div>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10, marginBottom:12 }}>
              {c.ia_breakdown.map(ia => (
                <div key={ia.component} style={{ background:'var(--surface2)', borderRadius:8, padding:'12px 14px', border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:12, color:'var(--text3)', marginBottom:4 }}>{ia.component}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                    <div>
                      <span style={{ fontSize:20, fontWeight:700, color: ia.marks != null ? 'var(--text)' : 'var(--text3)' }}>{ia.marks ?? '—'}</span>
                      <span style={{ fontSize:12, color:'var(--text3)' }}>/{ia.max_marks}</span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:10, color:'var(--text3)' }}>Scaled</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--accent)' }}>{ia.scaled_marks ?? '—'}/{ia.weightage}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom: courseAttempts.length ? 12 : 0 }}>
              <ScorePill label="IA Total"    value={c.int_total}   color="var(--blue)" />
              <ScorePill label="ESE Marks"   value={c.ese_marks}   color="var(--accent)" />
              <ScorePill label="Grand Total" value={c.grand_total} color={GRADE_COLORS[c.grade]||'var(--text)'} bold />
            </div>

            {/* Exam Attempts Timeline */}
            {courseAttempts.length > 0 && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
                <button onClick={() => setExpandedCourse(isExpanded ? null : c.course_code)}
                  style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, fontWeight:600, padding:0 }}>
                  {isExpanded ? '▾' : '▸'} Exam History ({courseAttempts.length} attempt{courseAttempts.length > 1 ? 's' : ''})
                </button>
                {isExpanded && (
                  <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                    {courseAttempts.map(att => (
                      <div key={att.id} style={{ display:'flex', alignItems:'center', gap:12, background:'var(--surface2)', borderRadius:8, padding:'10px 14px', borderLeft:`3px solid ${ATT_TYPE_COLOR[att.attempt_type]||'var(--border2)'}` }}>
                        <div style={{ minWidth:80 }}>
                          <div style={{ fontSize:11, color:'var(--text3)' }}>#{att.attempt_no}</div>
                          <div style={{ fontSize:12, fontWeight:600, color:ATT_TYPE_COLOR[att.attempt_type] }}>{att.attempt_type}</div>
                        </div>
                        <div style={{ flex:1, fontSize:12, color:'var(--text3)' }}>
                          {att.conducted_on ? new Date(att.conducted_on).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : att.academic_year}
                        </div>
                        <div style={{ fontSize:18, fontWeight:700, color: att.ese_marks != null ? 'var(--text)' : 'var(--text3)', minWidth:48, textAlign:'right' }}>
                          {att.ese_marks ?? '—'}
                        </div>
                        <span className={`badge ${ATT_STATUS_BADGE[att.status]||'badge-gray'}`}>{att.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function ScorePill({ label, value, color, bold }) {
  return (
    <div style={{ background:'var(--surface2)', borderRadius:8, padding:'8px 16px', display:'flex', gap:10, alignItems:'center' }}>
      <span style={{ fontSize:12, color:'var(--text3)' }}>{label}</span>
      <span style={{ fontSize: bold ? 18 : 15, fontWeight: bold ? 800 : 600, color: color||'var(--text)' }}>{value ?? '—'}</span>
    </div>
  )
}
