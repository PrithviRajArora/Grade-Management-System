import { useEffect, useState, useCallback } from 'react'
import { backlogs as api, examAttempts as attApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'

const STATUS_BADGE  = { Active: 'badge-red', Cleared: 'badge-green', Lapsed: 'badge-gray' }
const REASON_BADGE  = { Failed: 'badge-red', Absent: 'badge-amber', Detained: 'badge-gray' }

export default function Backlogs() {
  const { user }  = useAuth()
  const toast     = useToast()
  const isAdmin   = user?.role === 'admin'
  const isStudent = user?.role === 'student'

  const [backlogs, setBacklogs] = useState([])
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(true)

  // filters
  const [fStudent,  setFStudent]  = useState(isStudent ? user.profile_id : '')
  const [fCourse,   setFCourse]   = useState('')
  const [fStatus,   setFStatus]   = useState('Active')
  const [fProgram,  setFProgram]  = useState('')
  const [fSemester, setFSemester] = useState('')

  // modals
  const [clearing, setClearing] = useState(null)   // backlog being cleared
  const [clearAttempt, setClearAttempt] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = {}
    if (fStudent)  params.student  = fStudent
    if (fCourse)   params.course   = fCourse
    if (fStatus)   params.status   = fStatus
    if (fProgram)  params.program  = fProgram
    if (fSemester) params.semester = fSemester

    try {
      const [bRes, sRes] = await Promise.all([
        api.list(params),
        api.summary(fStudent ? { student: fStudent } : {}),
      ])
      setBacklogs(bRes.data.results ?? bRes.data)
      setSummary(sRes.data)
    } catch {
      toast.error('Failed to load backlogs.')
    } finally {
      setLoading(false)
    }
  }, [fStudent, fCourse, fStatus, fProgram, fSemester])

  useEffect(() => { load() }, [load])

  async function handleClear(backlog) {
    try {
      await api.clear(backlog.id, clearAttempt ? { clearing_attempt: clearAttempt } : {})
      toast.success('Backlog cleared.')
      setClearing(null)
      setClearAttempt('')
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to clear backlog.')
    }
  }

  async function handleLapse(backlog) {
    if (!confirm(`Mark backlog for ${backlog.student} in ${backlog.course} as Lapsed?`)) return
    try {
      await api.lapse(backlog.id)
      toast.success('Backlog marked as lapsed.')
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed.')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{isStudent ? 'My Backlogs' : 'Backlog Management'}</div>
          <div className="page-desc">
            {isStudent
              ? 'Courses where you have an uncleared exam debt'
              : 'Track and manage student exam backlogs across all courses'}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="stat-grid mb-24">
          <SummaryCard label="Total Backlogs" value={summary.total}   color="" />
          <SummaryCard label="Active"          value={summary.active}  color="red" />
          <SummaryCard label="Cleared"         value={summary.cleared} color="green" />
          <SummaryCard label="Lapsed"          value={summary.lapsed}  color="" />
        </div>
      )}

      {/* Filters — hide for student (auto-filter by own ID) */}
      {!isStudent && (
        <div className="card mb-24" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            <input className="form-input" placeholder="Student ID" value={fStudent}
                   onChange={e => setFStudent(e.target.value)} />
            <input className="form-input" placeholder="Course code" value={fCourse}
                   onChange={e => setFCourse(e.target.value)} />
            <select className="form-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option>Active</option>
              <option>Cleared</option>
              <option>Lapsed</option>
            </select>
            <input className="form-input" placeholder="Semester" type="number" min={1} max={12}
                   value={fSemester} onChange={e => setFSemester(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={load}>Apply</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Caused By</th>
                <th>Cleared By</th>
                <th>Created</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </td></tr>
              ) : backlogs.length === 0 ? (
                <tr><td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>
                  {fStatus === 'Active' ? '🎉 No active backlogs!' : 'No backlogs found.'}
                </td></tr>
              ) : backlogs.map(b => (
                <tr key={b.id}>
                  <td>
                    <div className="text-mono" style={{ fontSize: 12 }}>{b.student}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{b.student_name}</div>
                  </td>
                  <td>
                    <span className="badge badge-amber text-mono">{b.course}</span>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{b.course_name}</div>
                  </td>
                  <td><span className={`badge ${REASON_BADGE[b.reason] || 'badge-gray'}`}>{b.reason}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[b.status] || 'badge-gray'}`}>{b.status}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {b.origin_attempt
                      ? <span className="text-mono">#{b.origin_attempt_info?.attempt_no} — {b.origin_attempt_info?.attempt_type}</span>
                      : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {b.clearing_attempt
                      ? <span className="text-mono">#{b.clearing_attempt_info?.attempt_no} ({b.clearing_attempt_info?.ese_marks} marks)</span>
                      : b.status === 'Cleared' ? 'Manual' : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {new Date(b.created_at).toLocaleDateString('en-IN')}
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {b.status === 'Active' && (
                          <>
                            <button className="btn btn-ghost btn-sm"
                                    onClick={() => { setClearing(b); setClearAttempt('') }}>
                              ✓ Clear
                            </button>
                            <button className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--text3)' }}
                                    onClick={() => handleLapse(b)}>
                              Lapse
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear modal */}
      {clearing && (
        <Modal title={`Clear Backlog — ${clearing.student} / ${clearing.course}`}
               onClose={() => setClearing(null)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
              <div style={{ marginBottom: 6 }}>
                <span className={`badge ${REASON_BADGE[clearing.reason]}`}>{clearing.reason}</span>
                {' '}backlog for <strong>{clearing.student_name}</strong> in <strong>{clearing.course_name}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                This is a manual override. Backlogs are normally cleared automatically when a student passes.
              </div>
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Clearing Attempt ID (optional)</label>
              <input className="form-input" type="number"
                     placeholder="Leave blank for manual clear"
                     value={clearAttempt} onChange={e => setClearAttempt(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setClearing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleClear(clearing)}>
                Confirm Clear
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function SummaryCard({ label, value, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
    </div>
  )
}
