import { useEffect, useState, useCallback } from 'react'
import { examAttempts as api, courses as coursesApi, students as studentsApi } from '../api'
import { courses as courseApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'

const ATTEMPT_TYPES = ['Regular', 'Makeup', 'Backlog', 'SpecialBacklog']
const STATUSES      = ['Scheduled', 'Appeared', 'Absent', 'Pass', 'Fail', 'Withheld']

const STATUS_BADGE = {
  Scheduled: 'badge-gray',
  Appeared:  'badge-blue',
  Absent:    'badge-amber',
  Pass:      'badge-green',
  Fail:      'badge-red',
  Withheld:  'badge-amber',
}

const TYPE_BADGE = {
  Regular:       'badge-blue',
  Makeup:        'badge-amber',
  Backlog:       'badge-red',
  SpecialBacklog:'badge-red',
}

export default function ExamAttempts() {
  const { user } = useAuth()
  const toast    = useToast()
  const isAdmin  = user?.role === 'admin'

  const [attempts, setAttempts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('list')         // list | register | results

  // filters
  const [filterCourse, setFilterCourse]   = useState('')
  const [filterStudent, setFilterStudent] = useState('')
  const [filterType, setFilterType]       = useState('')
  const [filterStatus, setFilterStatus]   = useState('')

  // register form
  const [regCourse, setRegCourse]         = useState('')
  const [regType, setRegType]             = useState('Regular')
  const [regYear, setRegYear]             = useState('2024-2025')
  const [regDate, setRegDate]             = useState('')
  const [regStudents, setRegStudents]     = useState('')   // comma-separated IDs
  const [regLoading, setRegLoading]       = useState(false)
  const [enrolledLoading, setEnrolledLoading] = useState(false)
  const [alreadyScheduled, setAlreadyScheduled] = useState([])  // student IDs with existing Scheduled attempt

  // bulk results
  const [resRows, setResRows]     = useState([])          // [{student,course,attempt_type,attempt_no,ese_marks,status}]
  const [resLoading, setResLoading] = useState(false)

  // single edit modal
  const [editing, setEditing]   = useState(null)
  const [editData, setEditData] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const params = {}
    if (filterCourse)  params.course       = filterCourse
    if (filterStudent) params.student      = filterStudent
    if (filterType)    params.attempt_type = filterType
    if (filterStatus)  params.status       = filterStatus
    try {
      const r = await api.list(params)
      setAttempts(r.data.results ?? r.data)
    } catch {
      toast.error('Failed to load exam attempts.')
    } finally {
      setLoading(false)
    }
  }, [filterCourse, filterStudent, filterType, filterStatus])

  useEffect(() => { if (tab === 'list') load() }, [tab, load])

  // ── Load enrolled students for a course ──────────────────────────────────
  async function loadEnrolledStudents() {
    if (!regCourse.trim()) { toast.warn('Enter a course code first.'); return }
    setEnrolledLoading(true)
    try {
      const [enrolledRes, attemptsRes] = await Promise.all([
        courseApi.students(regCourse.trim()),
        api.list({ course: regCourse.trim(), attempt_type: regType, status: 'Scheduled' }),
      ])
      const enrolled = enrolledRes.data?.results ?? enrolledRes.data ?? []
      const scheduled = attemptsRes.data?.results ?? attemptsRes.data ?? []
      const scheduledIds = new Set(scheduled.map(a => a.student))
      setAlreadyScheduled([...scheduledIds])
      const allIds = enrolled.map(e => e.student || e.student_id).filter(Boolean)
      const newIds = allIds.filter(id => !scheduledIds.has(id))
      if (allIds.length === 0) {
        toast.warn('No students enrolled in this course.')
      } else if (newIds.length === 0) {
        toast.warn(`All ${allIds.length} enrolled student(s) already have a Scheduled attempt. Nothing to register.`)
        setRegStudents(allIds.join(', '))
      } else {
        setRegStudents(newIds.join(', '))
        if (scheduledIds.size > 0)
          toast.warn(`${scheduledIds.size} student(s) already scheduled — excluded from the list below.`)
        else
          toast.success(`Loaded ${newIds.length} enrolled student(s).`)
      }
    } catch {
      toast.error('Failed to load enrolled students.')
    } finally {
      setEnrolledLoading(false)
    }
  }

  // ── Bulk Register ─────────────────────────────────────────────────────────
  async function handleRegister() {
    if (!regCourse || !regStudents.trim()) {
      toast.warn('Course and at least one student ID are required.')
      return
    }
    const studentList = regStudents.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
    setRegLoading(true)
    try {
      const r = await api.bulkRegister({
        course: regCourse,
        attempt_type: regType,
        academic_year: regYear,
        conducted_on: regDate || null,
        students: studentList,
      })
      const d = r.data
      toast.success(`Registered ${d.registered} student(s).`)
      if (d.skipped_duplicate?.length)
        toast.warn(`${d.skipped_duplicate.length} already had a Scheduled attempt.`)
      if (d.missing_students?.length)
        toast.error(`Not found: ${d.missing_students.join(', ')}`)
      setAlreadyScheduled([])
      setTab('list')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Registration failed.')
    } finally {
      setRegLoading(false)
    }
  }

  // ── Bulk Results ──────────────────────────────────────────────────────────
  function addResRow() {
    setResRows(r => [...r, { student: '', course: '', attempt_type: 'Regular', attempt_no: 1, ese_marks: '', status: 'Pass' }])
  }
  function updateResRow(i, field, value) {
    setResRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }
  function removeResRow(i) {
    setResRows(r => r.filter((_, idx) => idx !== i))
  }

  async function handleBulkResults() {
    if (!resRows.length) { toast.warn('Add at least one result row.'); return }
    setResLoading(true)
    try {
      const payload = resRows.map(r => ({
        ...r,
        attempt_no: parseInt(r.attempt_no),
        ese_marks: r.ese_marks !== '' ? parseFloat(r.ese_marks) : null,
      }))
      const res = await api.bulkResults({ results: payload })
      toast.success(`Saved ${res.data.saved?.length} result(s).`)
      if (res.data.errors?.length) toast.error(`${res.data.errors.length} error(s) — check console.`)
      setResRows([])
      setTab('list')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save results.')
    } finally {
      setResLoading(false)
    }
  }

  // ── Edit single attempt ───────────────────────────────────────────────────
  async function handleEditSave() {
    try {
      await api.update(editing.id, editData)
      toast.success('Attempt updated.')
      setEditing(null)
      load()
    } catch (e) {
      const d = e.response?.data
      toast.error(d?.ese_marks?.[0] || d?.detail || 'Update failed.')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Exam Attempts</div>
          <div className="page-desc">Manage ESE sittings — Regular, Makeup, Backlog, Special Backlog</div>
        </div>

      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {['list', ...(isAdmin || user?.role === 'faculty' ? ['register','results'] : [])].map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`}>
            {{ list:'View Attempts', register:'Register Students', results:'Enter Results' }[t]}
          </button>
        ))}
      </div>

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <>
          {/* Filters */}
          <div className="card mb-24" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
              <input className="form-input" placeholder="Course code…" value={filterCourse}
                     onChange={e => setFilterCourse(e.target.value)} />
              <input className="form-input" placeholder="Student ID…"  value={filterStudent}
                     onChange={e => setFilterStudent(e.target.value)} />
              <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                {ATTEMPT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select className="form-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={load}>Apply</button>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Attempt</th>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Date</th>
                    <th>ESE Marks</th>
                    <th>Status</th>
                    <th>Year</th>
                    {(isAdmin || user?.role === 'faculty') && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>
                      <div className="spinner" style={{ margin: '0 auto' }} />
                    </td></tr>
                  ) : attempts.length === 0 ? (
                    <tr><td colSpan={9} className="text-muted" style={{ textAlign: 'center', padding: 32 }}>
                      No exam attempts found matching the current filters.
                    </td></tr>
                  ) : attempts.map((a, i) => (
                    <tr key={a.id}>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <span className={`badge ${TYPE_BADGE[a.attempt_type] || 'badge-gray'}`}>{a.attempt_type}</span>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>#{a.attempt_no}</div>
                      </td>
                      <td>
                        <div className="text-mono" style={{ fontSize: 12 }}>{a.student}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.student_name}</div>
                      </td>
                      <td>
                        <span className="badge badge-amber text-mono">{a.course}</span>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{a.course_name}</div>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                        {a.conducted_on ? new Date(a.conducted_on).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="font-bold" style={{ color: 'var(--accent)' }}>
                        {a.ese_marks ?? '—'}
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>{a.status}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>{a.academic_year}</td>
                      {(isAdmin || user?.role === 'faculty') && (
                        <td>
                          <button className="btn btn-ghost btn-sm"
                                  onClick={() => { setEditing(a); setEditData({ ese_marks: a.ese_marks ?? '', status: a.status, remarks: a.remarks ?? '' }) }}>
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── REGISTER TAB ── */}
      {tab === 'register' && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="card-header"><div className="card-title">Register Students for Exam</div></div>
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group mb-0" style={{ flex: 1 }}>
                <label className="form-label">Course Code *</label>
                <input className="form-input" placeholder="e.g. CS401" value={regCourse}
                       onChange={e => { setRegCourse(e.target.value.toUpperCase()); setAlreadyScheduled([]) }} />
              </div>
              <button className="btn btn-ghost btn-sm" onClick={loadEnrolledStudents}
                      disabled={enrolledLoading} style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>
                {enrolledLoading ? 'Loading…' : '↓ Load Enrolled Students'}
              </button>
            </div>

            {alreadyScheduled.length > 0 && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>
                <strong>Note:</strong> <strong>{alreadyScheduled.length}</strong> student(s) already have a Scheduled attempt and were excluded:&nbsp;
                <span style={{ fontFamily: 'monospace' }}>{alreadyScheduled.join(', ')}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group mb-0">
                <label className="form-label">Attempt Type *</label>
                <select className="form-input" value={regType} onChange={e => { setRegType(e.target.value); setAlreadyScheduled([]) }}>
                  {ATTEMPT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group mb-0">
                <label className="form-label">Academic Year *</label>
                <input className="form-input" placeholder="2024-2025" value={regYear}
                       onChange={e => setRegYear(e.target.value)} />
              </div>
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Exam Date (optional)</label>
              <input className="form-input" type="date" value={regDate}
                     onChange={e => setRegDate(e.target.value)} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Student IDs *</label>
              <textarea className="form-input" rows={4}
                        placeholder="Enter a course code above and click ↓ Load Enrolled Students, or enter IDs manually separated by commas or newlines&#10;e.g. S001, S002, S003"
                        value={regStudents} onChange={e => setRegStudents(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                {regStudents.split(/[\s,]+/).filter(Boolean).length} student(s) entered
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setTab('list'); setAlreadyScheduled([]) }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRegister} disabled={regLoading}>
                {regLoading ? 'Registering…' : 'Register Students'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTS TAB ── */}
      {tab === 'results' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Enter Exam Results</div>
              <div className="card-subtitle">Bulk entry — results trigger automatic backlog and pass/fail updates</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={addResRow}>+ Add Row</button>
          </div>

          {resRows.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>
              Click "+ Add Row" to start entering results
            </div>
          ) : (
            <div style={{ padding: '0 0 16px' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 60px 90px 1fr 28px', gap: 8, padding: '8px 0', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border)' }}>
                <span>Student ID</span><span>Course</span><span>Type</span><span>Att#</span><span>ESE Marks</span><span>Status</span><span></span>
              </div>
              {resRows.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 60px 90px 1fr 28px', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <input className="form-input" placeholder="S001" value={row.student}
                         onChange={e => updateResRow(i, 'student', e.target.value)} style={{ padding: '6px 10px' }} />
                  <input className="form-input" placeholder="CS401" value={row.course}
                         onChange={e => updateResRow(i, 'course', e.target.value.toUpperCase())} style={{ padding: '6px 10px' }} />
                  <select className="form-input" value={row.attempt_type}
                          onChange={e => updateResRow(i, 'attempt_type', e.target.value)} style={{ padding: '6px 10px' }}>
                    {ATTEMPT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input className="form-input" type="number" min={1} value={row.attempt_no}
                         onChange={e => updateResRow(i, 'attempt_no', e.target.value)} style={{ padding: '6px 10px' }} />
                  <input className="form-input" type="number" min={0} placeholder="0–100" value={row.ese_marks}
                         onChange={e => updateResRow(i, 'ese_marks', e.target.value)} style={{ padding: '6px 10px' }} />
                  <select className="form-input" value={row.status}
                          onChange={e => updateResRow(i, 'status', e.target.value)} style={{ padding: '6px 10px' }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => removeResRow(i)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setResRows([])}>Clear All</button>
                <button className="btn btn-primary" onClick={handleBulkResults} disabled={resLoading}>
                  {resLoading ? 'Saving…' : `Save ${resRows.length} Result(s)`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editing && (
        <Modal title={`Edit Attempt — ${editing.student} / ${editing.course}`} onClose={() => setEditing(null)} width={440}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group mb-0">
              <label className="form-label">Status</label>
              <select className="form-input" value={editData.status}
                      onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group mb-0">
              <label className="form-label">ESE Marks</label>
              <input className="form-input" type="number" min={0} placeholder="Enter marks"
                     value={editData.ese_marks}
                     onChange={e => setEditData(d => ({ ...d, ese_marks: e.target.value }))} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Remarks</label>
              <textarea className="form-input" rows={3} value={editData.remarks}
                        onChange={e => setEditData(d => ({ ...d, remarks: e.target.value }))} />
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>
              Note: All attempt records are preserved in the database for audit and analysis.
              Updating the status here records the outcome for this specific attempt.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditSave}>Save Changes</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
