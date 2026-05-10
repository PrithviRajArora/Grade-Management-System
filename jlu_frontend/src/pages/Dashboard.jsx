import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analytics, backlogs as backlogApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import { SkeletonStatGrid, SkeletonCard } from '../components/Skeleton'

function gradeBadgeClass(grade) {
  const map = { O: 'badge-green', 'A+': 'badge-blue', A: 'badge-blue',
    'B+': 'badge-amber', B: 'badge-amber', C: 'badge-gray', F: 'badge-red', 'N/A': 'badge-gray' }
  return map[grade] || 'badge-gray'
}

export default function Dashboard() {
  const { user }          = useAuth()
  const navigate          = useNavigate()
  const toast             = useToast()
  const [data, setData]   = useState(null)
  const [backlogCount, setBacklogCount] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analytics.dashboard(),
      backlogApi.summary({}),
    ])
      .then(([r, bs]) => { setData(r.data); setBacklogCount(bs.data) })
      .catch(e => toast.error(e.response?.data?.message || 'Failed to load dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <>
      <div className="page-header">
        <div className="page-title" style={{ height:28, width:200, background:'var(--border2)', borderRadius:6 }} />
      </div>
      <SkeletonStatGrid count={4} />
      <SkeletonCard lines={6} />
    </>
  )
  if (!data) return null

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          Welcome back, {user?.full_name?.split(' ')[0]} 👋
        </div>
        <div className="page-desc">
          {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </div>
      </div>

      {user?.role === 'admin'   && <AdminDash data={data} navigate={navigate} backlogCount={backlogCount} />}
      {user?.role === 'faculty' && <FacultyDash data={data} navigate={navigate} />}
      {user?.role === 'student' && <StudentDash data={data} backlogCount={backlogCount} />}
    </>
  )
}

/* ── Admin Dashboard ─────────────────────────────────────── */
function AdminDash({ data, navigate, backlogCount }) {
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Total Students"   value={data.total_students}         color=""      icon="◉" />
        <StatCard label="Faculty Members"  value={data.total_faculty}          color="blue"  icon="◈" />
        <StatCard label="Active Courses"   value={data.total_courses}          color=""      icon="▣" />
        <StatCard label="Total Enrolments" value={data.total_enrolments}       color=""      icon="⊞" />
        <StatCard label="Marks Pending"    value={data.marks_entries_pending}  color="red"   icon="⚠" />
        <StatCard label="ESE Pending"      value={data.ese_pending}            color="red"   icon="⚑" />
        <StatCard label="Results Complete" value={data.result_sheets_complete} color="green" icon="✓" />
        {backlogCount && (
          <StatCard label="Active Backlogs" value={backlogCount.active}
                    color={backlogCount.active > 0 ? 'red' : 'green'} icon="⚑"
                    onClick={() => navigate('/backlogs')} />
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Marks Activity</div>
            <div className="card-subtitle">Last 10 entries across all courses</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Component</th>
                <th>Course</th>
                <th>Marks</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(data.recent_marks_entries || []).map((e, i) => (
                <tr key={i}>
                  <td><span className="text-mono">{e.student__roll_no}</span></td>
                  <td>{e.component__name}</td>
                  <td><span className="badge badge-amber">{e.component__course__course_code}</span></td>
                  <td className="font-bold text-accent">{e.marks_obtained ?? '—'}</td>
                  <td className="text-muted">{new Date(e.updated_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
              {!data.recent_marks_entries?.length && (
                <tr><td colSpan={5} className="text-muted" style={{ textAlign: 'center' }}>No entries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ── Faculty Dashboard ───────────────────────────────────── */
function FacultyDash({ data, navigate }) {
  const courses = data.courses || []
  return (
    <>
      <div className="stat-grid">
        <StatCard label="My Courses"      value={courses.length}                                   color=""     icon="◈" />
        <StatCard label="Total Students"  value={courses.reduce((a,c) => a + c.enrolled_students, 0)} color=""  icon="◉" />
        <StatCard label="ESE Pending"     value={courses.reduce((a,c) => a + c.ese_pending, 0)}     color="red" icon="⚑" />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">My Courses This Semester</div>
            <div className="card-subtitle">Click a course to enter marks</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/courses')}>
            View All →
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Course</th>
                <th>Semester</th>
                <th>Students</th>
                <th>Marks %</th>
                <th>ESE</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.course_code} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/courses/${c.course_code}`)}>
                  <td><span className="badge badge-amber text-mono">{c.course_code}</span></td>
                  <td>{c.course_name}</td>
                  <td>Sem {c.semester}</td>
                  <td>{c.enrolled_students}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div
                          className={`progress-fill ${c.marks_completion_pct >= 80 ? 'green' : c.marks_completion_pct < 30 ? 'red' : ''}`}
                          style={{ width: `${c.marks_completion_pct}%` }}
                        />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text2)', minWidth: 36 }}>
                        {c.marks_completion_pct}%
                      </span>
                    </div>
                  </td>
                  <td>
                    {c.ese_pending > 0
                      ? <span className="badge badge-red">{c.ese_pending} pending</span>
                      : <span className="badge badge-green">Done</span>
                    }
                  </td>
                </tr>
              ))}
              {!courses.length && (
                <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>
                  No courses assigned.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ── Student Dashboard ───────────────────────────────────── */
function StudentDash({ data, backlogCount }) {
  const [selectedCourse, setSelectedCourse] = useState(null)

  return (
    <>
      <div className="stat-grid">
        <StatCard label="Program"     value={data.program}            color=""      icon="▣" isText />
        <StatCard label="Semester"    value={`Sem ${data.semester}`}  color=""      icon="◈" isText />
        <StatCard label="Courses"     value={data.results?.length ?? 0} color=""    icon="⊞" />
        <StatCard label="Avg Score"   value={data.sgpa_approx ? `${(data.sgpa_approx * 10).toFixed(1)}%` : '—'} color="green" icon="✓" isText />
        {backlogCount && (
          <StatCard label="Active Backlogs" value={backlogCount.active}
                    color={backlogCount.active > 0 ? 'red' : 'green'} icon="⚑" />
        )}
      </div>

      {backlogCount?.active > 0 && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13 }}>
          ⚑ You have <strong>{backlogCount.active}</strong> active backlog{backlogCount.active > 1 ? 's' : ''}.
          {' '}<a href="/my-backlogs" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>View details →</a>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">My Results</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                  <th>Course</th>
                  <th>Name</th>
                  <th>Sem</th>
                  <th>IA Total</th>
                  <th>ESE</th>
                  <th>Grand Total</th>
                  <th>Grade</th>
                  <th>Status</th>
                </tr>
            </thead>
            <tbody>
              {(data.results || []).map(r => (
                <tr key={r.course_code} style={{ cursor: 'pointer' }} onClick={() => setSelectedCourse(r)} title="Click to view course details">
                  <td><span className="badge badge-amber text-mono">{r.course_code}</span></td>
                  <td>{r.course_name}</td>
                  <td>Sem {r.semester}</td>
                  <td>{r.int_total ?? '—'}</td>
                  <td>{r.ese_marks ?? '—'}</td>
                  <td className="font-bold">{r.grand_total ?? '—'}</td>
                  <td><span className={`badge ${gradeBadgeClass(r.grade)}`}>{r.grade}</span></td>
                  <td>
                    {r.pass_status === 'Pass'       && <span className="badge badge-green">✓ Pass</span>}
                    {r.pass_status === 'Fail'       && <span className="badge badge-red">✕ Fail</span>}
                    {r.pass_status === 'Withheld'   && <span className="badge badge-amber">⚑ Withheld</span>}
                    {(!r.pass_status || r.pass_status === 'Incomplete') && <span className="badge badge-gray">Pending</span>}
                  </td>
                </tr>
              ))}
              {!data.results?.length && (
                <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>
                  No results yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCourse && (
        <Modal title="Course Details" onClose={() => setSelectedCourse(null)} width={400}>
          <div style={{ padding: '10px 0' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Course Code</div>
              <div className="text-mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>{selectedCourse.course_code}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Course Name</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedCourse.course_name}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Semester</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Sem {selectedCourse.semester}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => setSelectedCourse(null)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ── Stat card ───────────────────────────────────────────── */
function StatCard({ label, value, color, icon, isText, onClick }) {
  return (
    <div className={`stat-card ${color}`} onClick={onClick}
         style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value${isText ? ' text-mono' : ''}`}
           style={isText ? { fontSize: 18, marginTop: 10 } : {}}>
        {value}
      </div>
    </div>
  )
}
