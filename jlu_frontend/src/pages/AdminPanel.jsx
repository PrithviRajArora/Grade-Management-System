import { useEffect, useState, useCallback, useRef } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { students as studentsApi, faculty as facultyApi, courses as coursesApi, org, iaComponents, enrolments as enrolmentsApi, users as usersApi } from '../api'

function useList(fetcher) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFetcher = useCallback(fetcher, [])
  const reload = useCallback(() => {
    setLoading(true)
    stableFetcher().then(r => setData(r.data.results ?? r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [stableFetcher])
  useEffect(() => { reload() }, [reload])
  return { data, loading, reload }
}

// ── Password Modal ────────────────────────────────────────────
function PasswordModal({ title, description, onConfirm, onClose, extraField }) {
  const [password, setPassword] = useState('')
  const [extraVal, setExtraVal] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const inputRef = useRef(null)
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (extraField && extraVal !== extraField.expected) {
      setError(`Type exactly: "${extraField.expected}"`)
      return
    }
    setLoading(true)
    try { await onConfirm(password, extraVal) }
    catch (err) { setError(err?.message || 'Incorrect password or action failed.') }
    finally { setLoading(false) }
  }

  return (
    <Modal title={title} onClose={onClose} width={440}>
      <form onSubmit={handleSubmit}>
        {description && <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 18, lineHeight: 1.6 }}>{description}</div>}
        <div className="form-group">
          <label className="form-label">Admin Password *</label>
          <input ref={inputRef} type="password" className="form-input" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
        </div>
        {extraField && (
          <div className="form-group">
            <label className="form-label">{extraField.label}</label>
            <input type="text" className="form-input" value={extraVal}
              onChange={e => setExtraVal(e.target.value)} placeholder={extraField.expected}
              style={extraVal && extraVal !== extraField.expected ? { borderColor: 'var(--red)' } : {}} />
            {extraVal && extraVal !== extraField.expected && (
              <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Must match exactly</div>
            )}
          </div>
        )}
        {error && <div className="alert alert-error" style={{ marginBottom: 12, padding: '10px 14px', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary"
            disabled={loading || !password || (extraField && extraVal !== extraField.expected)}>
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Verifying…</> : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Unlock Reason Modal ───────────────────────────────────────
function UnlockReasonModal({ courseCode, onConfirm, onClose }) {
  const [reason, setReason]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) { setError('Please provide a reason.'); return }
    setLoading(true)
    try { await onConfirm(reason.trim()) }
    catch (err) { setError(err?.message || 'Failed to unlock.') }
    finally { setLoading(false) }
  }

  return (
    <Modal title={`Unlock Course — ${courseCode}`} onClose={onClose} width={460}>
      <form onSubmit={handleSubmit}>
        <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 18, lineHeight: 1.6 }}>
          Unlocking allows faculty to edit marks again. The reason will be permanently logged.
        </div>
        <div className="form-group">
          <label className="form-label">Reason for Unlocking *</label>
          <textarea className="form-input" rows={3} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Faculty reported data entry error in component 2"
            required style={{ resize: 'vertical' }} />
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 12, padding: '10px 14px', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading || !reason.trim()}>
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Unlocking…</> : '🔓 Unlock'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ══ Main ══════════════════════════════════════════════════════
export default function AdminPanel() {
  const { user } = useAuth()
  const toast    = useToast()
  const [tab, setTab] = useState('students')

  if (user?.role !== 'admin') return <div className="alert alert-error">Admin access only.</div>

  const TABS = [
    ['students', '◉ Students'],
    ['faculty',  '◈ Faculty'],
    ['courses',  '▣ Courses'],
    ['orgs',     '⊞ Organisations'],
  ]

  return (
    <>
      <div className="page-header">
        <div className="page-title">Admin Panel</div>
        <div className="page-desc">Create and manage students, faculty, and courses</div>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            color: tab === key ? 'var(--accent)' : 'var(--text3)',
            fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`, marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>
      {tab === 'students' && <StudentsPanel toast={toast} />}
      {tab === 'faculty'  && <FacultyPanel  toast={toast} />}
      {tab === 'courses'  && <CoursesPanel  toast={toast} />}
      {tab === 'orgs'     && <OrgsPanel     toast={toast} />}
    </>
  )
}

// ══ STUDENTS ══════════════════════════════════════════════════
function StudentsPanel({ toast }) {
  const { data: programs } = useList(() => org.programs({ page_size: 200 }))
  const [modal, setModal]         = useState(false)
  const [promoteModal, setPromote] = useState(false)
  const [search, setSearch]       = useState('')
  const [list, setList]           = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [deleting, setDeleting]   = useState(null)
  const [editStudent, setEditStudent] = useState(null)

  const load = useCallback((q = search) => {
    setLoading(true)
    studentsApi.list({ search: q, page_size: 50 })
      .then(r => { setList(r.data.results ?? r.data); setTotal(r.data.count ?? 0) })
      .catch(() => toast.error('Failed to load students.'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(() => load(search), 300); return () => clearTimeout(t) }, [search])

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove student "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try { await studentsApi.delete(id); toast.success('✓ Student removed.'); load() }
    catch (e) { toast.error(e.response?.data?.message || 'Delete failed.') }
    finally { setDeleting(null) }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search by name, roll no, JLU ID…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setPromote(true)}>⇑ Promote Batch</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Student</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
          : list.length === 0 ? <div className="empty-state"><div className="icon">◉</div><p>No students found.</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Student ID</th><th>Roll No</th><th>Name</th><th>Program</th><th>Sem</th><th>Year</th><th></th></tr></thead>
                <tbody>
                  {list.map(s => (
                    <tr key={s.student_id}>
                      <td><span className="text-mono" style={{ color: 'var(--accent)' }}>{s.student_id}</span></td>
                      <td><span className="text-mono">{s.roll_no}</span></td>
                      <td>{s.user_info?.first_name} {s.user_info?.last_name}</td>
                      <td style={{ fontSize: 12 }}>{s.program_name}</td>
                      <td>Sem {s.semester}</td>
                      <td className="text-muted">{s.academic_year}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/students/${s.student_id}`, '_blank')}>View Report</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditStudent(s)}>✎ Edit</button>
                          <button className="btn btn-danger btn-sm" disabled={deleting === s.student_id}
                            onClick={() => handleDelete(s.student_id, `${s.user_info?.first_name} ${s.user_info?.last_name}`)}>
                            {deleting === s.student_id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > list.length && <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>Showing {list.length} of {total}. Refine your search.</div>}
            </div>
          )}
      </div>
      {modal && <AddStudentModal programs={programs} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} toast={toast} />}
      {editStudent && <EditStudentModal student={editStudent} onClose={() => setEditStudent(null)} onSaved={() => { setEditStudent(null); load() }} toast={toast} />}
      {promoteModal && <PromoteBatchModal programs={programs} onClose={() => setPromote(false)} toast={toast} onDone={() => { setPromote(false); load() }} />}
    </div>
  )
}

function PromoteBatchModal({ programs, onClose, toast, onDone }) {
  const [form, setForm]     = useState({ program: '', semester: '1', academic_year: '' })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!form.program || !form.academic_year) { toast.error('All fields required.'); return }
    setSaving(true)
    try {
      const { data } = await studentsApi.promoteBatch({ program: parseInt(form.program), semester: parseInt(form.semester), academic_year: form.academic_year })
      setResult(data)
    } catch (err) { toast.error(err.response?.data?.detail || 'Promotion failed.') }
    finally { setSaving(false) }
  }

  if (result) return (
    <Modal title="Batch Promotion Complete" onClose={onDone} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['Promoted', result.promoted?.length ?? 0, 'var(--green)'], ['Courses Deprecated', result.deprecated_courses ?? 0, 'var(--blue)'],
            ['Not Passed', result.skipped_not_passed?.length ?? 0, 'var(--amber)'], ['At Max Sem', result.skipped_max_semester?.length ?? 0, 'var(--text3)']
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </div>
        {result.promoted?.length > 0 && <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Promoted:</div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', background: 'var(--surface2)', borderRadius: 8, padding: 10, maxHeight: 100, overflowY: 'auto' }}>{result.promoted.join(', ')}</div>
        </div>}
        {result.skipped_not_passed?.length > 0 && <div>
          <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 6 }}>Kept (not passed):</div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', background: 'var(--surface2)', borderRadius: 8, padding: 10, maxHeight: 80, overflowY: 'auto' }}>{result.skipped_not_passed.join(', ')}</div>
        </div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={onDone}>Done</button></div>
      </div>
    </Modal>
  )

  return (
    <Modal title="Promote Batch to Next Semester" onClose={onClose} width={480}>
      <form onSubmit={submit}>
        <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 18, lineHeight: 1.6 }}>
          Students who passed all courses in the selected semester will be promoted. Associated courses will be flagged as deprecated.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Program *</label>
            <select className="form-select" value={form.program} onChange={e => setForm({...form, program: e.target.value})} required>
              <option value="">Select program…</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.short_name} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Current Semester *</label>
            <select className="form-select" value={form.semester} onChange={e => setForm({...form, semester: e.target.value})} required>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(s => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Academic Year *</label>
            <input className="form-input" value={form.academic_year} onChange={e => setForm({...form, academic_year: e.target.value})} placeholder="e.g. 2024-2025" required />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Processing…</> : '⇑ Promote Batch'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AddStudentModal({ programs, onClose, onSaved, toast }) {
  const [form, setForm] = useState({ student_id:'',jlu_id:'',email:'',password:'',first_name:'',last_name:'',roll_no:'',gender:'Male',program:'',semester:'1',section:'',academic_year:'' })
  const [saving, setSaving] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  useEffect(() => { studentsApi.nextId().then(r => setForm(p => ({ ...p, student_id: p.student_id || r.data.student_id, jlu_id: p.jlu_id || r.data.jlu_id }))).catch(() => {}) }, [])

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, program: parseInt(form.program), semester: parseInt(form.semester) }
      if (!payload.password) delete payload.password   // let backend default to 'Password'
      await studentsApi.create(payload)
      toast.success(`✓ Student ${form.first_name} ${form.last_name} created.`); onSaved()
    } catch (err) {
      const data = err.response?.data
      toast.error(data?.message || (data?.errors ? Object.entries(data.errors).map(([k,v]) => `${k}: ${v}`).join(' · ') : 'Failed.'))
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Add New Student" onClose={onClose} width={560}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Student ID"   value={form.student_id}   onChange={f('student_id')}   placeholder="e.g. S005" required />
          <FormField label="JLU ID"       value={form.jlu_id}       onChange={f('jlu_id')}        placeholder="e.g. STU005" required />
          <FormField label="First Name"   value={form.first_name}   onChange={f('first_name')}    required />
          <FormField label="Last Name"    value={form.last_name}    onChange={f('last_name')}     required />
          <FormField label="Email"        value={form.email}        onChange={f('email')}         type="email" required />
          <FormField label="Password (optional)" value={form.password} onChange={f('password')} type="password" placeholder="Leave blank — default: 'Password'" />
          <FormField label="Roll No"      value={form.roll_no}      onChange={f('roll_no')}       placeholder="e.g. 21BTCSE005" required />
          <div className="form-group">
            <label className="form-label">Gender *</label>
            <select className="form-select" value={form.gender} onChange={f('gender')} required>{['Male','Female','Other'].map(g => <option key={g}>{g}</option>)}</select>
          </div>
          <div className="form-group">
            <label className="form-label">Program *</label>
            <select className="form-select" value={form.program} onChange={f('program')} required>
              <option value="">Select program…</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.short_name} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Semester *</label>
            <select className="form-select" value={form.semester} onChange={f('semester')} required>{[1,2,3,4,5,6,7,8,9,10,11,12].map(s => <option key={s} value={s}>Sem {s}</option>)}</select>
          </div>
          <FormField label="Section"       value={form.section}       onChange={f('section')}       placeholder="e.g. A" />
          <FormField label="Academic Year" value={form.academic_year} onChange={f('academic_year')} placeholder="e.g. 2023-2024" required />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Creating…</> : 'Create Student'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ══ FACULTY ═══════════════════════════════════════════════════
function FacultyPanel({ toast }) {
  const { data: schools } = useList(() => org.schools({ page_size: 100 }))
  const { data: list, loading, reload } = useList(() => facultyApi.list({ page_size: 200 }))
  const [modal, setModal] = useState(false)
  const [editFaculty, setEditFaculty] = useState(null)
  const [resetPwFaculty, setResetPwFaculty] = useState(null)
  const [deleting, setDel] = useState(null)

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove faculty "${name}"? This cannot be undone.`)) return
    setDel(id)
    try { await facultyApi.delete(id); toast.success('✓ Faculty removed.'); reload() }
    catch (e) {
      const d = e.response?.data
      const msg = d?.detail || d?.message || (Array.isArray(d) ? d[0] : null) || 'Delete failed.'
      const isFk = typeof msg === 'string' && (msg.toLowerCase().includes('foreign key') || msg.toLowerCase().includes('referenced') || msg.toLowerCase().includes('constraint') || e.response?.status === 409)
      toast.error(isFk ? 'Cannot delete: this faculty is still assigned to one or more courses. Reassign or delete those courses first.' : msg)
    }
    finally { setDel(null) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Faculty</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
          : list.length === 0 ? <div className="empty-state"><div className="icon">◈</div><p>No faculty yet.</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Faculty ID</th><th>Name</th><th>School</th><th>Department</th><th>JLU ID</th><th></th></tr></thead>
                <tbody>
                  {list.map(f => (
                    <tr key={f.faculty_id}>
                      <td><span className="text-mono" style={{ color: 'var(--accent)' }}>{f.faculty_id}</span></td>
                      <td>{f.name}</td>
                      <td style={{ fontSize: 12 }}>{f.school_name}</td>
                      <td style={{ fontSize: 12 }}>{f.department ?? '—'}</td>
                      <td><span className="text-mono" style={{ fontSize: 12 }}>{f.user_info?.jlu_id}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditFaculty(f)}>✎ Edit</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--amber)' }} onClick={() => setResetPwFaculty(f)} title="Reset this faculty member's password">🔑 Reset PW</button>
                          <button className="btn btn-danger btn-sm" disabled={deleting === f.faculty_id} onClick={() => handleDelete(f.faculty_id, f.name)}>{deleting === f.faculty_id ? '…' : 'Delete'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
      {modal && <AddFacultyModal schools={schools} onClose={() => setModal(false)} onSaved={() => { setModal(false); reload() }} toast={toast} />}
      {editFaculty && <EditFacultyModal faculty={editFaculty} onClose={() => setEditFaculty(null)} onSaved={() => { setEditFaculty(null); reload() }} toast={toast} />}
      {resetPwFaculty && <ResetPasswordModal user={resetPwFaculty} onClose={() => setResetPwFaculty(null)} toast={toast} />}
    </div>
  )
}

function AddFacultyModal({ schools, onClose, onSaved, toast }) {
  const [form, setForm] = useState({ faculty_id:'',jlu_id:'',email:'',password:'',first_name:'',last_name:'',name:'',school:'',department:'' })
  const [saving, setSaving] = useState(false)
  const [idHint, setIdHint] = useState('')
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  // Auto-suggest the next faculty_id and jlu_id on modal open
  useEffect(() => {
    facultyApi.nextId()
      .then(r => {
        setForm(p => ({
          ...p,
          faculty_id: p.faculty_id || r.data.faculty_id,
          jlu_id:     p.jlu_id     || r.data.jlu_id,
        }))
        setIdHint(`Suggested: ${r.data.faculty_id} / ${r.data.jlu_id}`)
      })
      .catch(() => {}) // non-critical — just leave blank if it fails
  }, [])

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, school: parseInt(form.school) }
      if (!payload.password) delete payload.password   // let backend default to 'Password'
      await facultyApi.create(payload); toast.success(`✓ Faculty ${form.name} created.`); onSaved()
    }
    catch (err) {
      const data = err.response?.data
      toast.error(data?.errors ? Object.entries(data.errors).map(([k,v]) => `${k}: ${v}`).join(' · ') : data?.message || 'Failed.')
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Add New Faculty" onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Faculty ID"  value={form.faculty_id} onChange={f('faculty_id')} placeholder="e.g. F002" required />
          <FormField label="JLU ID"      value={form.jlu_id}     onChange={f('jlu_id')}     placeholder="e.g. FAC002" required />
          {idHint && (
            <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text3)', marginTop: -8 }}>
              💡 {idHint}
            </div>
          )}
          <FormField label="First Name"  value={form.first_name} onChange={f('first_name')} required />
          <FormField label="Last Name"   value={form.last_name}  onChange={f('last_name')}  required />
          <FormField label="Email"       value={form.email}      onChange={f('email')}       type="email" required />
          <FormField label="Password (optional)" value={form.password} onChange={f('password')} type="password" placeholder="Leave blank — default: 'Password'" />
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Display Name *</label>
            <input className="form-input" value={form.name} onChange={f('name')} placeholder="e.g. Prof. Ramesh Sharma" required />
          </div>
          <div className="form-group">
            <label className="form-label">School *</label>
            <select className="form-select" value={form.school} onChange={f('school')} required>
              <option value="">Select school…</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.short_name ?? s.name}</option>)}
            </select>
          </div>
          <FormField label="Department" value={form.department} onChange={f('department')} placeholder="e.g. Computer Science" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Creating…</> : 'Create Faculty'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ══ COURSES ════════════════════════════════════════════════════
function CoursesPanel({ toast }) {
  const { data: programs }    = useList(() => org.programs({ page_size: 200 }))
  const { data: facultyList } = useList(() => facultyApi.list({ page_size: 200 }))
  const { data: list, loading, reload } = useList(() => coursesApi.list({ page_size: 200 }))
  const [modal, setModal]           = useState(false)
  const [compModal, setCompModal]   = useState(null)
  const [editModal, setEditModal]   = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [unlockModal, setUnlockModal] = useState(null)
  const [unlockAllModal, setUnlockAllModal] = useState(false)
  const [search, setSearch]         = useState('')

  async function handleDelete(course, password, phrase) {
    try {
      await coursesApi.delete(course.course_code, { admin_password: password, confirmation: phrase })
      toast.success(`✓ Course ${course.course_code} deleted.`)
      setDeleteModal(null); reload()
    } catch (e) { throw new Error(e.response?.data?.detail || e.response?.data?.message || 'Delete failed.') }
  }

  async function handleUnlock(course, reason) {
    try {
      await coursesApi.unlock(course.course_code, { reason })
      toast.success(`Course ${course.course_code} unlocked.`)
      setUnlockModal(null); reload()
    } catch (e) { throw new Error(e.response?.data?.detail || e.response?.data?.message || 'Failed to unlock.') }
  }

  async function handleUnlockAll(reason) {
    const locked = list.filter(c => c.is_submitted).length
    if (!locked) { toast.warn('No locked courses.'); return }
    try {
      await coursesApi.unlockBulk({ reason })
      toast.success(`✓ ${locked} course(s) unlocked.`)
      setUnlockAllModal(false); reload()
    } catch (e) { throw new Error(e.response?.data?.detail || e.response?.data?.message || 'Failed.') }
  }

  const filtered = list.filter(c =>
    c.course_code.toLowerCase().includes(search.toLowerCase()) ||
    c.course_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Filter by code or name…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => { if (!list.filter(c=>c.is_submitted).length) { toast.warn('No locked courses.'); return; } setUnlockAllModal(true) }}>🔓 Unlock All</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Course</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
          : filtered.length === 0 ? <div className="empty-state"><div className="icon">▣</div><p>No courses found.</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Sem</th><th>Credits</th><th>Faculty</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.course_code} style={{ opacity: c.is_deprecated ? 0.6 : 1 }}>
                      <td><span className="text-mono" style={{ color: 'var(--accent)' }}>{c.course_code}</span></td>
                      <td style={{ maxWidth: 200 }}>{c.course_name}</td>
                      <td><span className="badge badge-blue">{c.course_type}</span></td>
                      <td>Sem {c.semester}</td>
                      <td>{c.credits} cr</td>
                      <td style={{ fontSize: 12 }}>{c.faculty_name ?? c.faculty}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {c.is_submitted  && <span className="badge badge-green"  style={{ fontSize: 10 }}>🔒 Locked</span>}
                          {c.is_deprecated && <span className="badge badge-gray"   style={{ fontSize: 10 }}>⊘ Deprecated</span>}
                          {!c.is_submitted && !c.is_deprecated && <span className="badge badge-amber" style={{ fontSize: 10 }}>Draft</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/courses/${c.course_code}`, '_blank')}>View</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setCompModal(c.course_code)}>+ IA</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditModal(c)}>✎ Edit</button>
                          {c.is_submitted && <button className="btn btn-ghost btn-sm" onClick={() => setUnlockModal(c)}>🔓 Unlock</button>}
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(c)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {modal      && <AddCourseModal programs={programs} facultyList={facultyList} onClose={() => setModal(false)} onSaved={() => { setModal(false); reload() }} toast={toast} />}
      {editModal  && <EditCourseModal course={editModal} programs={programs} facultyList={facultyList} onClose={() => setEditModal(null)} onSaved={() => { setEditModal(null); reload() }} toast={toast} />}
      {compModal  && <IAComponentsModal courseCode={compModal} onClose={() => setCompModal(null)} toast={toast} />}
      {deleteModal && (
        <PasswordModal
          title={`Delete Course — ${deleteModal.course_code}`}
          description={<span>Permanently delete <strong>{deleteModal.course_code} — {deleteModal.course_name}</strong>. This removes all marks, components, and results and cannot be undone.</span>}
          extraField={{ label: 'Type the confirmation phrase exactly:', expected: 'Delete this course and all data along with it.' }}
          onConfirm={(pw, phrase) => handleDelete(deleteModal, pw, phrase)}
          onClose={() => setDeleteModal(null)}
        />
      )}
      {unlockModal     && <UnlockReasonModal courseCode={unlockModal.course_code} onConfirm={r => handleUnlock(unlockModal, r)} onClose={() => setUnlockModal(null)} />}
      {unlockAllModal  && <UnlockReasonModal courseCode="All Locked Courses" onConfirm={handleUnlockAll} onClose={() => setUnlockAllModal(false)} />}
    </div>
  )
}

// ── Edit Course Modal ─────────────────────────────────────────
function EditCourseModal({ course, programs, facultyList, onClose, onSaved, toast }) {
  const [step, setStep]           = useState('password')
  const [password, setPassword]   = useState('')
  const [pwError, setPwError]     = useState('')
  const [pwChecking, setPwChecking] = useState(false)
  const pwRef = useRef(null)
  useEffect(() => { setTimeout(() => pwRef.current?.focus(), 80) }, [])

  const [form, setForm] = useState({
    course_name: course.course_name, course_type: course.course_type,
    faculty: course.faculty, program: String(course.program), semester: String(course.semester),
    academic_year: course.academic_year, term: String(course.term),
    lecture_hrs: String(course.lecture_hrs), tutorial_hrs: String(course.tutorial_hrs), practical_hrs: String(course.practical_hrs),
    credits: String(course.credits), int_weightage: String(course.int_weightage), ese_weightage: String(course.ese_weightage),
    ese_mode: course.ese_mode, ese_duration_hrs: String(course.ese_duration_hrs), ese_max_marks: String(course.ese_max_marks),
  })
  const [saving, setSaving] = useState(false)
  const f = k => e => {
    const val = e.target.value
    setForm(p => { const n = {...p,[k]:val}; if(k==='int_weightage') n.ese_weightage=String(100-parseInt(val||0)); if(k==='ese_weightage') n.int_weightage=String(100-parseInt(val||0)); return n })
  }

  async function verifyPassword(e) {
    e.preventDefault(); if (!password) return
    setPwChecking(true); setPwError('')
    try {
      await coursesApi.update(course.course_code, { admin_password: password })
      setStep('edit')
    } catch (err) {
      if (err.response?.status === 403) setPwError(err.response?.data?.detail || 'Incorrect password.')
      else setStep('edit') // password OK, other validation error
    } finally { setPwChecking(false) }
  }

  async function submit(e) {
    e.preventDefault()
    if (parseInt(form.int_weightage)+parseInt(form.ese_weightage) !== 100) { toast.error('IA + ESE must sum to 100.'); return }
    setSaving(true)
    try {
      await coursesApi.update(course.course_code, {
        ...form, admin_password: password,
        program: parseInt(form.program), semester: parseInt(form.semester), term: parseInt(form.term),
        lecture_hrs: parseInt(form.lecture_hrs), tutorial_hrs: parseInt(form.tutorial_hrs), practical_hrs: parseInt(form.practical_hrs),
        credits: parseInt(form.credits), int_weightage: parseInt(form.int_weightage), ese_weightage: parseInt(form.ese_weightage),
        ese_duration_hrs: parseInt(form.ese_duration_hrs), ese_max_marks: parseInt(form.ese_max_marks),
      })
      toast.success(`✓ Course ${course.course_code} updated.`); onSaved()
    } catch (err) { toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed.') }
    finally { setSaving(false) }
  }

  if (step === 'password') return (
    <Modal title={`Edit Course — ${course.course_code}`} onClose={onClose} width={420}>
      <form onSubmit={verifyPassword}>
        <div style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 18, lineHeight: 1.6 }}>Enter your admin password to edit this course.</div>
        <div className="form-group">
          <label className="form-label">Admin Password *</label>
          <input ref={pwRef} type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        {pwError && <div className="alert alert-error" style={{ marginBottom: 12, padding: '10px 14px', fontSize: 13 }}>{pwError}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={pwChecking || !password}>{pwChecking ? <><span className="spinner" style={{ width:14,height:14 }}/> Verifying…</> : 'Continue →'}</button>
        </div>
      </form>
    </Modal>
  )

  const weightageOk = parseInt(form.int_weightage||0) + parseInt(form.ese_weightage||0) === 100
  return (
    <Modal title={`Edit Course — ${course.course_code}`} onClose={onClose} width={840}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div className="form-group"><label className="form-label">Course Name *</label><input className="form-input" value={form.course_name} onChange={f('course_name')} required /></div>
          <div className="form-group"><label className="form-label">Course Type *</label><select className="form-select" value={form.course_type} onChange={f('course_type')} required>{['Foundation','Core','MD','SEC','AECC','OE'].map(t=><option key={t}>{t}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Faculty *</label><select className="form-select" value={form.faculty} onChange={f('faculty')} required><option value="">Select…</option>{facultyList.map(fc=><option key={fc.faculty_id} value={fc.faculty_id}>{fc.name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Program *</label><select className="form-select" value={form.program} onChange={f('program')} required><option value="">Select…</option>{programs.map(p=><option key={p.id} value={p.id}>{p.short_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Semester *</label><select className="form-select" value={form.semester} onChange={f('semester')} required>{[1,2,3,4,5,6,7,8,9,10,11,12].map(s=><option key={s} value={s}>Sem {s}</option>)}</select></div>
          <FormField label="Academic Year" value={form.academic_year} onChange={f('academic_year')} required />
          <FormField label="Term" value={form.term} onChange={f('term')} type="number" min="1" required />
          <FormField label="Lecture Hrs" value={form.lecture_hrs} onChange={f('lecture_hrs')} type="number" min="0" required />
          <FormField label="Tutorial Hrs" value={form.tutorial_hrs} onChange={f('tutorial_hrs')} type="number" min="0" required />
          <FormField label="Practical Hrs" value={form.practical_hrs} onChange={f('practical_hrs')} type="number" min="0" required />
          <FormField label="Credits" value={form.credits} onChange={f('credits')} type="number" min="1" required />
          <div className="form-group"><label className="form-label">IA Weightage % *</label><input className="form-input" type="number" min="0" max="100" value={form.int_weightage} onChange={f('int_weightage')} required style={!weightageOk?{borderColor:'var(--red)'}:{}} /></div>
          <div className="form-group"><label className="form-label">ESE Weightage % *</label><input className="form-input" type="number" min="0" max="100" value={form.ese_weightage} onChange={f('ese_weightage')} required style={!weightageOk?{borderColor:'var(--red)'}:{}} />{!weightageOk&&<div style={{fontSize:11,color:'var(--red)',marginTop:4}}>Must sum to 100</div>}</div>
          <div className="form-group"><label className="form-label">ESE Mode *</label><select className="form-select" value={form.ese_mode} onChange={f('ese_mode')} required>{['Written','Viva Voce','Coding Test','Practical'].map(m=><option key={m}>{m}</option>)}</select></div>
          <FormField label="ESE Duration (hrs)" value={form.ese_duration_hrs} onChange={f('ese_duration_hrs')} type="number" min="1" required />
          <FormField label="ESE Max Marks" value={form.ese_max_marks} onChange={f('ese_max_marks')} type="number" min="1" required />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !weightageOk}>{saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Saving…</> : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  )
}

function AddCourseModal({ programs, facultyList, onClose, onSaved, toast }) {
  const [form, setForm] = useState({ course_code:'',course_name:'',course_type:'Core',faculty:'',program:'',semester:'1',academic_year:'',term:'1',lecture_hrs:'3',tutorial_hrs:'1',practical_hrs:'0',credits:'4',int_weightage:'40',ese_weightage:'60',ese_mode:'Written',ese_duration_hrs:'3',ese_max_marks:'100' })
  const [saving, setSaving] = useState(false)
  const f = k => e => { const val=e.target.value; setForm(p=>{const n={...p,[k]:val};if(k==='int_weightage')n.ese_weightage=String(100-parseInt(val||0));if(k==='ese_weightage')n.int_weightage=String(100-parseInt(val||0));return n}) }

  async function submit(e) {
    e.preventDefault()
    if (!form.course_code.trim()||!form.course_name.trim()||!form.faculty||!form.program||!form.academic_year.trim()) { toast.error('All required fields must be filled.'); return }
    if (parseInt(form.int_weightage)+parseInt(form.ese_weightage)!==100) { toast.error('IA + ESE must sum to 100.'); return }
    setSaving(true)
    try {
      await coursesApi.create({ ...form, program:parseInt(form.program),semester:parseInt(form.semester),term:parseInt(form.term),lecture_hrs:parseInt(form.lecture_hrs),tutorial_hrs:parseInt(form.tutorial_hrs),practical_hrs:parseInt(form.practical_hrs),credits:parseInt(form.credits),int_weightage:parseInt(form.int_weightage),ese_weightage:parseInt(form.ese_weightage),ese_duration_hrs:parseInt(form.ese_duration_hrs),ese_max_marks:parseInt(form.ese_max_marks) })
      toast.success(`✓ Course ${form.course_code} created.`); onSaved()
    } catch (err) {
      const data=err.response?.data; toast.error(data?.errors?Object.entries(data.errors).map(([k,v])=>`${k}: ${v}`).join(' · '):data?.message||'Failed.')
    } finally { setSaving(false) }
  }

  const weightageOk = parseInt(form.int_weightage||0)+parseInt(form.ese_weightage||0)===100
  return (
    <Modal title="Add New Course" onClose={onClose} width={840}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <FormField label="Course Code" value={form.course_code} onChange={f('course_code')} placeholder="e.g. CS401" required />
          <div className="form-group"><label className="form-label">Course Type *</label><select className="form-select" value={form.course_type} onChange={f('course_type')} required>{['Foundation','Core','MD','SEC','AECC','OE'].map(t=><option key={t}>{t}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Course Name *</label><input className="form-input" value={form.course_name} onChange={f('course_name')} placeholder="e.g. Operating Systems" required /></div>
          <div className="form-group"><label className="form-label">Faculty *</label><select className="form-select" value={form.faculty} onChange={f('faculty')} required><option value="">Select faculty…</option>{facultyList.map(fc=><option key={fc.faculty_id} value={fc.faculty_id}>{fc.name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Program *</label><select className="form-select" value={form.program} onChange={f('program')} required><option value="">Select program…</option>{programs.map(p=><option key={p.id} value={p.id}>{p.short_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Semester *</label><select className="form-select" value={form.semester} onChange={f('semester')} required>{[1,2,3,4,5,6,7,8,9,10,11,12].map(s=><option key={s} value={s}>Sem {s}</option>)}</select></div>
          <FormField label="Academic Year" value={form.academic_year} onChange={f('academic_year')} placeholder="2024-2025" required />
          <FormField label="Term" value={form.term} onChange={f('term')} type="number" min="1" required />
          <FormField label="Lecture Hrs" value={form.lecture_hrs} onChange={f('lecture_hrs')} type="number" min="0" required />
          <FormField label="Tutorial Hrs" value={form.tutorial_hrs} onChange={f('tutorial_hrs')} type="number" min="0" required />
          <FormField label="Practical Hrs" value={form.practical_hrs} onChange={f('practical_hrs')} type="number" min="0" required />
          <FormField label="Credits" value={form.credits} onChange={f('credits')} type="number" min="1" required />
          <div className="form-group"><label className="form-label">IA Weightage % *</label><input className="form-input" type="number" min="0" max="100" value={form.int_weightage} onChange={f('int_weightage')} required style={!weightageOk?{borderColor:'var(--red)'}:{}} /></div>
          <div className="form-group"><label className="form-label">ESE Weightage % *</label><input className="form-input" type="number" min="0" max="100" value={form.ese_weightage} onChange={f('ese_weightage')} required style={!weightageOk?{borderColor:'var(--red)'}:{}} />{!weightageOk&&<div style={{fontSize:11,color:'var(--red)',marginTop:4}}>Must sum to 100</div>}</div>
          <div className="form-group"><label className="form-label">ESE Mode *</label><select className="form-select" value={form.ese_mode} onChange={f('ese_mode')} required>{['Written','Viva Voce','Coding Test','Practical'].map(m=><option key={m}>{m}</option>)}</select></div>
          <FormField label="ESE Duration (hrs)" value={form.ese_duration_hrs} onChange={f('ese_duration_hrs')} type="number" min="1" required />
          <FormField label="ESE Max Marks" value={form.ese_max_marks} onChange={f('ese_max_marks')} type="number" min="1" required />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving||!weightageOk}>{saving?<><span className="spinner" style={{width:14,height:14}}/> Creating…</>:'Create Course'}</button>
        </div>
      </form>
    </Modal>
  )
}

function IAComponentsModal({ courseCode, onClose, toast }) {
  const { data: existing, reload } = useList(() => iaComponents.list({ course: courseCode }))
  const [form, setForm]       = useState({ name:'',mode:'Offline',max_marks:'',weightage:'' })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [intWeightage, setIntWeightage] = useState(100)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => { coursesApi.get(courseCode).then(r => setIntWeightage(r.data.int_weightage ?? 100)).catch(() => {}) }, [courseCode])

  const totalWt   = existing.reduce((a, c) => a + parseFloat(c.weightage || 0), 0)
  const remaining = intWeightage - totalWt
  const newWt     = parseFloat(form.weightage || 0)
  const wouldExceed = newWt > remaining

  async function addComponent(e) {
    e.preventDefault()
    if (wouldExceed) { toast.error(`Exceeds IA limit. Only ${remaining.toFixed(2)}% remaining.`); return }
    setSaving(true)
    try {
      await iaComponents.create({ course: courseCode, name: form.name, mode: form.mode, max_marks: parseFloat(form.max_marks), weightage: newWt })
      toast.success(`✓ Component "${form.name}" added.`)
      setForm({ name:'',mode:'Offline',max_marks:'',weightage:'' }); reload()
    } catch (err) {
      const data=err.response?.data; toast.error(data?.errors?Object.entries(data.errors).map(([k,v])=>`${k}: ${v}`).join(' · '):data?.message||data?.detail||'Failed.')
    } finally { setSaving(false) }
  }

  async function deleteComp(id, name) {
    if (!window.confirm(`Delete component "${name}"? All marks will be lost.`)) return
    setDeleting(id)
    try { await iaComponents.delete(id); toast.success('✓ Component deleted.'); reload() }
    catch { toast.error('Delete failed.') }
    finally { setDeleting(null) }
  }

  const overLimit = remaining < 0

  return (
    <Modal title={`IA Components — ${courseCode}`} onClose={onClose} width={540}>
      {existing.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>Current components</span>
            <span>Total: <strong style={{ color: overLimit?'var(--red)':totalWt===intWeightage?'var(--green)':'var(--text)' }}>{totalWt}% / {intWeightage}%</strong></span>
          </div>
          {existing.map(c => (
            <div key={c.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:8,background:'var(--surface2)',marginBottom:6 }}>
              <span style={{ flex:1,fontWeight:600 }}>{c.name}</span>
              <span className="badge badge-gray">{c.mode}</span>
              <span style={{ fontSize:12,color:'var(--text2)' }}>Max: {c.max_marks}</span>
              <span style={{ fontSize:12,color:'var(--accent)' }}>{c.weightage}%</span>
              <button className="btn btn-danger btn-sm" style={{ fontSize:11 }} disabled={deleting===c.id} onClick={() => deleteComp(c.id,c.name)}>{deleting===c.id?'…':'×'}</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ borderTop:existing.length?'1px solid var(--border)':'none', paddingTop:existing.length?16:0 }}>
        <div style={{ fontSize:13,fontWeight:600,marginBottom:12,color:'var(--text2)' }}>Add Component</div>
        {remaining <= 0 && <div className="alert alert-error" style={{ marginBottom:12,padding:'10px 14px',fontSize:13 }}>IA weightage cap ({intWeightage}%) reached. Delete a component to add a new one.</div>}
        <form onSubmit={addComponent}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <FormField label="Name" value={form.name} onChange={f('name')} placeholder="e.g. Mid-Term Test" required />
            <div className="form-group">
              <label className="form-label">Mode *</label>
              <select className="form-select" value={form.mode} onChange={f('mode')} required>{['Online','Offline','Certificate','Hackathon'].map(m=><option key={m}>{m}</option>)}</select>
            </div>
            <FormField label="Max Marks" value={form.max_marks} onChange={f('max_marks')} type="number" min="1" required />
            <div className="form-group">
              <label className="form-label">Weightage % * <span style={{ color:wouldExceed?'var(--red)':'var(--text3)',fontWeight:400 }}>({remaining.toFixed(1)}% left)</span></label>
              <input className="form-input" type="number" min="0.5" max={Math.max(0,remaining)} step="0.5"
                value={form.weightage} onChange={f('weightage')} required style={wouldExceed?{borderColor:'var(--red)'}:{}} />
              {wouldExceed && <div style={{ fontSize:11,color:'var(--red)',marginTop:4 }}>Exceeds limit — max: {remaining.toFixed(2)}%</div>}
            </div>
          </div>
          <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Done</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving||remaining<=0||wouldExceed}>{saving?'…':'+ Add'}</button>
          </div>
        </form>
      </div>
    </Modal>
  )
}


// ── Edit Student Modal (info fields only — not program/school/division) ───────
function EditStudentModal({ student, onClose, onSaved, toast }) {
  const userId = student.user
  const [form, setForm] = useState({
    first_name:   student.user_info?.first_name ?? '',
    last_name:    student.user_info?.last_name  ?? '',
    email:        student.user_info?.email      ?? '',
    section:      student.section      ?? '',
    academic_year: student.academic_year ?? '',
    roll_no:      student.roll_no ?? '',
    gender:       student.gender ?? 'Male',
  })
  const [saving, setSaving] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    try {
      // Update user fields (name, email) and student fields (section, year, roll, gender) separately
      await Promise.all([
        usersApi.update(userId, { first_name: form.first_name, last_name: form.last_name, email: form.email }),
        studentsApi.update(student.student_id, { section: form.section, academic_year: form.academic_year, roll_no: form.roll_no, gender: form.gender }),
      ])
      toast.success(`✓ Student ${form.first_name} ${form.last_name} updated.`)
      onSaved()
    } catch (err) {
      const data = err.response?.data
      toast.error(data?.message || (data ? Object.values(data).flat().join(' · ') : 'Update failed.'))
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Edit Student — ${student.student_id}`} onClose={onClose} width={520}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
        ℹ Program, school, and academic division cannot be changed here. Contact a system administrator for structural changes.
      </div>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="First Name"    value={form.first_name}    onChange={f('first_name')}    required />
          <FormField label="Last Name"     value={form.last_name}     onChange={f('last_name')}     required />
          <FormField label="Email"         value={form.email}         onChange={f('email')}         type="email" required />
          <FormField label="Roll No"       value={form.roll_no}       onChange={f('roll_no')}       required />
          <div className="form-group">
            <label className="form-label">Gender *</label>
            <select className="form-select" value={form.gender} onChange={f('gender')} required>
              {['Male','Female','Other'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <FormField label="Section"       value={form.section}       onChange={f('section')}       placeholder="e.g. A" />
          <FormField label="Academic Year" value={form.academic_year} onChange={f('academic_year')} placeholder="e.g. 2023-2024" required style={{ gridColumn: '1 / -1' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Edit Faculty Modal (info fields only — not school/division) ───────────────
function EditFacultyModal({ faculty, onClose, onSaved, toast }) {
  const userId = faculty.user
  const [form, setForm] = useState({
    first_name: faculty.user_info?.first_name ?? '',
    last_name:  faculty.user_info?.last_name  ?? '',
    email:      faculty.user_info?.email      ?? '',
    name:       faculty.name       ?? '',
    department: faculty.department ?? '',
  })
  const [saving, setSaving] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    try {
      await Promise.all([
        usersApi.update(userId, { first_name: form.first_name, last_name: form.last_name, email: form.email }),
        facultyApi.update(faculty.faculty_id, { name: form.name, department: form.department }),
      ])
      toast.success(`✓ Faculty ${form.name} updated.`)
      onSaved()
    } catch (err) {
      const data = err.response?.data
      toast.error(data?.message || (data ? Object.values(data).flat().join(' · ') : 'Update failed.'))
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Edit Faculty — ${faculty.faculty_id}`} onClose={onClose} width={480}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
        ℹ School and academic division cannot be changed here. Contact a system administrator for structural changes.
      </div>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="First Name"    value={form.first_name} onChange={f('first_name')} required />
          <FormField label="Last Name"     value={form.last_name}  onChange={f('last_name')}  required />
          <FormField label="Email"         value={form.email}      onChange={f('email')}       type="email" required style={{ gridColumn: '1 / -1' }} />
          <FormField label="Display Name"  value={form.name}       onChange={f('name')}        required     style={{ gridColumn: '1 / -1' }} />
          <FormField label="Department"    value={form.department} onChange={f('department')}  placeholder="e.g. Computer Science" style={{ gridColumn: '1 / -1' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Reset Password Modal ──────────────────────────────────────
function ResetPasswordModal({ user, onClose, toast }) {
  const [adminPw, setAdminPw] = useState('')
  const [newPw, setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [useDefault, setUseDefault] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const inputRef = useRef(null)
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  const displayName = user.name || `${user.user_info?.first_name ?? ''} ${user.user_info?.last_name ?? ''}`.trim()
  const jluId = user.user_info?.jlu_id ?? user.jlu_id ?? ''

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!adminPw) { setError('Enter your admin password.'); return }
    if (!useDefault) {
      if (newPw.length < 6) { setError('New password must be at least 6 characters.'); return }
      if (newPw !== confirmPw) { setError('Passwords do not match.'); return }
    }
    setLoading(true)
    try {
      await usersApi.resetPassword(user.user, {
        admin_password: adminPw,
        new_password: useDefault ? 'Password' : newPw,
      })
      toast.success(`✓ Password for ${displayName} (${jluId}) has been reset.${useDefault ? ' Default password: "Password"' : ''}`)
      onClose()
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Reset failed.'
      setError(msg)
    } finally { setLoading(false) }
  }

  return (
    <Modal title={`Reset Password — ${displayName}`} onClose={onClose} width={480}>
      <form onSubmit={submit}>
        <div style={{
          fontSize: 13, color: 'var(--text2)', marginBottom: 18, lineHeight: 1.7,
          padding: '12px 16px', borderRadius: 10,
          background: 'rgba(245,166,35,.06)', border: '1px solid rgba(245,166,35,.25)',
        }}>
          <strong style={{ color: 'var(--amber)' }}>⚠ Password Reset</strong><br/>
          This will reset the password for <strong>{displayName}</strong> ({jluId}).
          They will be required to change it on next login.
        </div>

        <div className="form-group">
          <label className="form-label">Your Admin Password *</label>
          <input ref={inputRef} type="password" className="form-input" value={adminPw}
            onChange={e => setAdminPw(e.target.value)} placeholder="Verify your identity" required />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            fontSize: 13, color: 'var(--text2)', userSelect: 'none',
          }}>
            <input type="checkbox" checked={useDefault}
              onChange={e => setUseDefault(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
            Use default password (<code style={{
              background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, fontSize: 12,
            }}>Password</code>)
          </label>
        </div>

        {!useDefault && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 4 }}>
            <div className="form-group">
              <label className="form-label">New Password *</label>
              <input type="password" className="form-input" value={newPw}
                onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters" required={!useDefault} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input type="password" className="form-input" value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)} placeholder="Re-enter password" required={!useDefault}
                style={confirmPw && confirmPw !== newPw ? { borderColor: 'var(--red)' } : {}} />
              {confirmPw && confirmPw !== newPw && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Passwords don't match</div>
              )}
            </div>
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: 12, padding: '10px 14px', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading || !adminPw || (!useDefault && (!newPw || newPw !== confirmPw))}>
            {loading ? <><span className="spinner" style={{ width:14,height:14 }}/> Resetting…</> : '🔑 Reset Password'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function FormField({ label, value, onChange, type='text', placeholder, required, min, style }) {
  return (
    <div className="form-group" style={style}>
      <label className="form-label">{label}{required?' *':''}</label>
      <input className="form-input" type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} min={min} />
    </div>
  )
}

// ══ ORGS ══════════════════════════════════════════════════════
function OrgsPanel({ toast }) {
  const { data: facs, loading: lf, reload: rf } = useList(() => org.facultyOf({ page_size: 100 }))
  const { data: schools, loading: ls, reload: rs } = useList(() => org.schools({ page_size: 200 }))
  const { data: programs, loading: lp, reload: rp } = useList(() => org.programs({ page_size: 200 }))
  const [addFac,setAddFac]=useState(false); const [facForm,setFacForm]=useState({name:'',short_name:''})
  const [addSch,setAddSch]=useState(false); const [schForm,setSchForm]=useState({name:'',short_name:'',faculty_of:''})
  const [addProg,setAddProg]=useState(false); const [progForm,setProgForm]=useState({name:'',short_name:'',school:'',duration_yrs:'4'})
  const [saving,setSaving]=useState(false)

  async function createFac(e) { e.preventDefault();setSaving(true);try{await org.createFacultyOf(facForm);toast.success('Division created.');rf();setAddFac(false);setFacForm({name:'',short_name:''})}catch(err){toast.error(err.response?.data?.name?.[0]||'Failed.')}finally{setSaving(false)} }
  async function deleteFac(id,name) { if(!window.confirm(`Delete division "${name}"?`))return;try{await org.deleteFacultyOf(id);toast.success('Deleted.');rf()}catch{toast.error('Delete failed — may have associated schools.')} }
  async function createSch(e) { e.preventDefault();setSaving(true);try{await org.createSchool({...schForm,faculty_of:parseInt(schForm.faculty_of)});toast.success('School created.');rs();setAddSch(false);setSchForm({name:'',short_name:'',faculty_of:''})}catch(err){toast.error(err.response?.data?.name?.[0]||'Failed.')}finally{setSaving(false)} }
  async function deleteSch(id,name) { if(!window.confirm(`Delete school "${name}"?`))return;try{await org.deleteSchool(id);toast.success('Deleted.');rs()}catch{toast.error('Delete failed.')} }
  async function createProg(e) { e.preventDefault();setSaving(true);try{await org.createProgram({...progForm,school:parseInt(progForm.school),duration_yrs:parseInt(progForm.duration_yrs)});toast.success('Program created.');rp();setAddProg(false);setProgForm({name:'',short_name:'',school:'',duration_yrs:'4'})}catch(err){toast.error(err.response?.data?.name?.[0]||err.response?.data?.short_name?.[0]||'Failed.')}finally{setSaving(false)} }
  async function deleteProg(id,name) { if(!window.confirm(`Delete program "${name}"?`))return;try{await org.deleteProgram(id);toast.success('Deleted.');rp()}catch{toast.error('Delete failed.')} }

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:24 }}>
      <div className="card">
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <div className="card-title">Academic Divisions ({facs.length})</div>
          <button className="btn btn-primary btn-sm" onClick={()=>setAddFac(!addFac)}>{addFac?'Cancel':'+ Add Division'}</button>
        </div>
        {addFac&&<form onSubmit={createFac} style={{ display:'flex',gap:10,marginBottom:16,alignItems:'flex-end' }}><FormField label="Name" value={facForm.name} onChange={e=>setFacForm({...facForm,name:e.target.value})} required style={{flex:1}} /><FormField label="Short Name" value={facForm.short_name} onChange={e=>setFacForm({...facForm,short_name:e.target.value})} style={{width:120}} /><button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving?'…':'Save'}</button></form>}
        {lf?<div className="loading"><div className="spinner" /></div>:<div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Short</th><th></th></tr></thead><tbody>{facs.map(f=><tr key={f.id}><td>{f.id}</td><td>{f.name}</td><td>{f.short_name||'—'}</td><td><button className="btn btn-danger btn-sm" onClick={()=>deleteFac(f.id,f.name)}>Delete</button></td></tr>)}</tbody></table></div>}
      </div>
      <div className="card">
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <div className="card-title">Schools ({schools.length})</div>
          <button className="btn btn-primary btn-sm" onClick={()=>setAddSch(!addSch)}>{addSch?'Cancel':'+ Add School'}</button>
        </div>
        {addSch&&<form onSubmit={createSch} style={{ display:'flex',gap:10,marginBottom:16,alignItems:'flex-end',flexWrap:'wrap' }}><FormField label="Name" value={schForm.name} onChange={e=>setSchForm({...schForm,name:e.target.value})} required style={{flex:1,minWidth:180}} /><FormField label="Short Name" value={schForm.short_name} onChange={e=>setSchForm({...schForm,short_name:e.target.value})} style={{width:120}} /><div className="form-group" style={{marginBottom:0,width:180}}><label className="form-label">Division *</label><select className="form-select" value={schForm.faculty_of} onChange={e=>setSchForm({...schForm,faculty_of:e.target.value})} required><option value="">Select…</option>{facs.map(f=><option key={f.id} value={f.id}>{f.short_name||f.name}</option>)}</select></div><button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving?'…':'Save'}</button></form>}
        {ls?<div className="loading"><div className="spinner" /></div>:<div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Short</th><th>Division</th><th></th></tr></thead><tbody>{schools.map(s=><tr key={s.id}><td>{s.id}</td><td>{s.name}</td><td>{s.short_name||'—'}</td><td>{s.faculty_of_name}</td><td><button className="btn btn-danger btn-sm" onClick={()=>deleteSch(s.id,s.name)}>Delete</button></td></tr>)}</tbody></table></div>}
      </div>
      <div className="card">
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <div className="card-title">Programs ({programs.length})</div>
          <button className="btn btn-primary btn-sm" onClick={()=>setAddProg(!addProg)}>{addProg?'Cancel':'+ Add Program'}</button>
        </div>
        {addProg&&<form onSubmit={createProg} style={{ display:'flex',gap:10,marginBottom:16,alignItems:'flex-end',flexWrap:'wrap' }}><FormField label="Name" value={progForm.name} onChange={e=>setProgForm({...progForm,name:e.target.value})} required style={{flex:1,minWidth:150}} /><FormField label="Short Name" value={progForm.short_name} onChange={e=>setProgForm({...progForm,short_name:e.target.value})} required style={{width:100}} /><div className="form-group" style={{marginBottom:0,width:180}}><label className="form-label">School *</label><select className="form-select" value={progForm.school} onChange={e=>setProgForm({...progForm,school:e.target.value})} required><option value="">Select…</option>{schools.map(s=><option key={s.id} value={s.id}>{s.short_name||s.name}</option>)}</select></div><FormField label="Duration (yrs)" value={progForm.duration_yrs} onChange={e=>setProgForm({...progForm,duration_yrs:e.target.value})} type="number" min="1" required style={{width:100}} /><button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving?'…':'Save'}</button></form>}
        {lp?<div className="loading"><div className="spinner" /></div>:<div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Short</th><th>School</th><th>Years</th><th></th></tr></thead><tbody>{programs.map(p=><tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td>{p.short_name}</td><td>{p.school_name}</td><td>{p.duration_yrs}</td><td><button className="btn btn-danger btn-sm" onClick={()=>deleteProg(p.id,p.name)}>Delete</button></td></tr>)}</tbody></table></div>}
      </div>
    </div>
  )
}
