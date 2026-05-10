import { useEffect, useState } from 'react'
import { analytics as analyticsApi, org as orgApi, courses as coursesApi, examStats as examStatsApi } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useToast } from '../context/ToastContext'

const GRADE_COLORS = {
  O: '#806800', 'A+': '#3D7A5E', A: '#3A6B96',
  'B+': '#5038A0', B: '#7A6030', C: '#B84D38', F: '#900000', 'N/A': '#6B7490',
}

export default function Analytics() {
  const toast = useToast()
  const [levelType, setLevelType] = useState('ALL') // 'FAC', 'SCH', 'PROG', 'COURSE'
  const [facId, setFacId] = useState('')
  const [schId, setSchId] = useState('')
  const [progId, setProgId] = useState('')
  const [courseCode, setCourseCode] = useState('')

  const [facs, setFacs] = useState([])
  const [schools, setSchools] = useState([])
  const [progs, setProgs] = useState([])
  const [coursesList, setCoursesList] = useState([])

  const [summary, setSummary] = useState(null)
  const [dist, setDist] = useState(null)
  const [toppers, setToppers] = useState(null)
  const [ia, setIA] = useState(null)
  const [examStats, setExamStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    orgApi.facultyOf().then(r => setFacs(r.data.results ?? r.data)).catch(console.error)
  }, [])

  useEffect(() => {
    if (!facId) { setSchools([]); setProgs([]); setCoursesList([]); return }
    orgApi.schools({ faculty_of: facId }).then(r => setSchools(r.data.results ?? r.data))
  }, [facId])

  useEffect(() => {
    if (!schId) { setProgs([]); setCoursesList([]); return }
    orgApi.programs({ school: schId }).then(r => setProgs(r.data.results ?? r.data))
  }, [schId])

  useEffect(() => {
    if (!progId) { setCoursesList([]); return }
    coursesApi.list({ program: progId }).then(r => setCoursesList(r.data.results ?? r.data))
  }, [progId])

  async function load() {
    let params = {}
    if (courseCode) params = { course: courseCode }
    else if (progId) params = { program: progId }
    else if (schId) params = { school: schId }
    else if (facId) params = { faculty_of: facId }
    else { toast.warn('Select a level to analyze'); return }

    setLoading(true)
    setError('')
    try {
      const [sRes, dRes, tRes, iRes] = await Promise.all([
        analyticsApi.courseSummary(params),
        analyticsApi.gradeDist(params),
        analyticsApi.toppers(params, 10),
        analyticsApi.iaBreakdown(params),
      ])
      setSummary(sRes.data)
      setDist(dRes.data)
      setToppers(tRes.data)
      setIA(iRes.data)

      // Fetch exam stats if a specific course is selected
      if (courseCode) {
        const years = ['2024-2025', '2023-2024']
        const statsResults = await Promise.all(
          years.map(yr => examStatsApi.list({ course: courseCode, academic_year: yr }).catch(() => null))
        )
        const allStats = statsResults.flatMap(r => r ? (r.data.results ?? r.data) : [])
        setExamStats(allStats.length ? allStats : null)
      } else {
        setExamStats(null)
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.detail || 'Course not found.'
      setError(msg)
      toast.error(msg)
      setSummary(null); setDist(null); setToppers(null); setIA(null); setExamStats(null)
    } finally {
      setLoading(false)
    }
  }

  const chartData = dist?.distribution?.filter(d => d.count > 0) ?? []

  return (
    <>
      <div className="page-header">
        <div className="page-title">Analytics</div>
        <div className="page-desc">Grade distributions, toppers, and IA breakdowns per course</div>
      </div>

      {/* Hierarchy Selection */}
      <div className="card mb-24">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="form-group mb-0">
            <label className="form-label">Academic Division</label>
            <select className="form-input" value={facId} onChange={e => { setFacId(e.target.value); setSchId(''); setProgId(''); setCourseCode('') }}>
              <option value="">-- All Divisions --</option>
              {facs.map(f => <option key={f.id} value={f.id}>{f.short_name || f.name}</option>)}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">School</label>
            <select className="form-input" value={schId} onChange={e => { setSchId(e.target.value); setProgId(''); setCourseCode('') }} disabled={!facId}>
              <option value="">-- All Schools --</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.short_name || s.name}</option>)}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Program</label>
            <select className="form-input" value={progId} onChange={e => { setProgId(e.target.value); setCourseCode('') }} disabled={!schId}>
              <option value="">-- All Programs --</option>
              {progs.map(p => <option key={p.id} value={p.id}>{p.short_name}</option>)}
            </select>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Course</label>
            <select className="form-input" value={courseCode} onChange={e => setCourseCode(e.target.value)} disabled={!progId}>
              <option value="">-- All Courses --</option>
              {coursesList.map(c => <option key={c.course_code} value={c.course_code}>{c.course_code}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={load} disabled={loading || (!facId && !schId && !progId && !courseCode)}>
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} />Loading…</> : 'Analyse →'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {summary && (
        <>
          {/* Summary stats */}
          <div className="stat-grid mb-24">
            <StatCard label="Enrolled"      value={summary.enrolled}      />
            <StatCard label="Marks Done"    value={`${summary.marks_completion_pct}%`} color="green" isText />
            <StatCard label="ESE Entered"   value={`${summary.ese_completion_pct}%`}   color="blue"  isText />
            <StatCard label="Pass %"        value={`${summary.pass_pct}%`}             color="green" isText />
            <StatCard label="Fail Count"    value={summary.fail_count}    color="red" />
            <StatCard label="Avg Total"     value={summary.grand_total?.avg ? parseFloat(summary.grand_total.avg).toFixed(1) : '—'} isText />
          </div>

          <div className="grid-2 mb-24" style={{ gap: 20 }}>
            {/* Grade distribution chart */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Grade Distribution</div>
              {chartData.length > 0
                ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <XAxis dataKey="grade" tick={{ fill: '#5C6480', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#5C6480', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: '#E1D9BC', border: '1px solid #C9C09E', borderRadius: 8, color: '#30364F' }}
                        formatter={(v, n, p) => [`${v} students (${p.payload.pct}%)`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[4,4,0,0]}>
                        {chartData.map(d => (
                          <Cell key={d.grade} fill={GRADE_COLORS[d.grade] ?? '#4d607f'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
                : <div className="empty-state"><p>No results computed yet.</p></div>
              }
            </div>

            {/* Score ranges */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Score Ranges</div>
              {[
                ['IA Total',    summary.int_total],
                ['ESE Marks',   summary.ese_marks],
                ['Grand Total', summary.grand_total],
              ].map(([label, s]) => (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{label}</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {['avg','max','min'].map(k => (
                      <div key={k} style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>{k}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                          {s?.[k] != null ? parseFloat(s[k]).toFixed(1) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Toppers */}
          {toppers?.toppers?.length > 0 && (
            <div className="card mb-24">
              <div className="card-title" style={{ marginBottom: 16 }}>🏆 Top Students</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Rank</th><th>Roll No</th><th>Name</th><th>Course</th><th>IA Total</th><th>ESE</th><th>Grand Total</th><th>Grade</th></tr>
                  </thead>
                  <tbody>
                    {toppers.toppers.map(t => (
                      <tr key={t.rank}>
                        <td>
                          <span style={{ fontWeight: 700, color: t.rank <= 3 ? 'var(--accent)' : 'var(--text3)' }}>
                            {t.rank <= 3 ? ['🥇','🥈','🥉'][t.rank-1] : `#${t.rank}`}
                          </span>
                        </td>
                        <td><span className="text-mono">{t.roll_no}</span></td>
                        <td>{t.name}</td>
                        <td><span className="badge badge-gray">{t.course}</span></td>
                        <td>{t.int_total ?? '—'}</td>
                        <td>{t.ese_marks ?? '—'}</td>
                        <td className="font-bold text-accent">{t.grand_total}</td>
                        <td><GradeBadge grade={t.grade} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Exam Attempt Statistics */}
          {examStats?.length > 0 && (
            <div className="card mb-24">
              <div className="card-title" style={{ marginBottom: 16 }}>📊 Exam Attempt Statistics</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Year</th><th>Type</th><th>Registered</th><th>Appeared</th>
                      <th>Absent</th><th>Pass</th><th>Fail</th><th>Withheld</th>
                      <th>Pass Rate</th><th>Avg Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examStats.map(s => (
                      <tr key={`${s.academic_year}-${s.attempt_type}`}>
                        <td style={{ fontSize: 12 }}>{s.academic_year}</td>
                        <td>
                          <span className={`badge ${
                            s.attempt_type === 'Regular' ? 'badge-blue' :
                            s.attempt_type === 'Makeup'  ? 'badge-amber' : 'badge-red'
                          }`}>{s.attempt_type}</span>
                        </td>
                        <td>{s.total_registered}</td>
                        <td>{s.total_appeared}</td>
                        <td style={{ color: s.total_absent > 0 ? 'var(--amber)' : undefined }}>{s.total_absent}</td>
                        <td style={{ color: 'var(--green)', fontWeight: 600 }}>{s.total_pass}</td>
                        <td style={{ color: s.total_fail > 0 ? 'var(--red)' : undefined }}>{s.total_fail}</td>
                        <td style={{ color: s.total_withheld > 0 ? 'var(--amber)' : undefined }}>{s.total_withheld}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                            <div className="progress-bar" style={{ flex: 1 }}>
                              <div className={`progress-fill ${parseFloat(s.pass_rate) >= 70 ? 'green' : parseFloat(s.pass_rate) < 40 ? 'red' : ''}`}
                                   style={{ width: `${s.pass_rate}%` }} />
                            </div>
                            <span style={{ fontSize: 12, minWidth: 36, color: 'var(--text2)' }}>{s.pass_rate}%</span>
                          </div>
                        </td>
                        <td className="font-bold text-accent">{s.avg_marks ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* IA Breakdown */}
          {ia?.components?.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>IA Component Breakdown</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Course</th><th>Component</th><th>Mode</th><th>Max</th><th>Wt%</th><th>Entries</th><th>Missing</th><th>Avg</th><th>Max Scored</th><th>Done</th></tr>
                  </thead>
                  <tbody>
                    {ia.components.map(c => (
                      <tr key={c.course+c.component}>
                        <td><span className="badge badge-gray">{c.course}</span></td>
                        <td>{c.component}</td>
                        <td><span className="badge badge-gray">{c.mode}</span></td>
                        <td>{c.max_marks}</td>
                        <td>{c.weightage}%</td>
                        <td>{c.entries}</td>
                        <td>
                          {c.missing > 0
                            ? <span className="badge badge-red">{c.missing}</span>
                            : <span className="badge badge-green">0</span>
                          }
                        </td>
                        <td>{c.avg_marks ?? '—'}</td>
                        <td>{c.max_marks_scored ?? '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                            <div className="progress-bar" style={{ flex: 1 }}>
                              <div className={`progress-fill ${c.completion_pct >= 80 ? 'green' : 'red'}`}
                                style={{ width: `${c.completion_pct}%` }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{c.completion_pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!summary && !loading && !error && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="icon">◎</div>
          <p>Enter a course code above to see analytics.</p>
        </div>
      )}
    </>
  )
}

function StatCard({ label, value, color, isText }) {
  return (
    <div className={`stat-card ${color || ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={isText ? { fontSize: 20, marginTop: 8 } : {}}>{value}</div>
    </div>
  )
}

function GradeBadge({ grade }) {
  const cls = { O:'badge-green','A+':'badge-blue',A:'badge-blue','B+':'badge-amber',B:'badge-amber',C:'badge-gray',F:'badge-red' }
  return <span className={`badge ${cls[grade] || 'badge-gray'}`}>{grade}</span>
}
