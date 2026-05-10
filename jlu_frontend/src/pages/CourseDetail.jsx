import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { courses as coursesApi, marks as marksApi, results as resultsApi, enrolments as enrolmentsApi, students as studentsApi, iaComponents as iaApi, org as orgApi, examAttempts as examAttemptsApi, backlogs as backlogsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ExportButton from '../components/ExportButton'
import Modal from '../components/Modal'

const GRADE_BANDS = [
  { grade: 'O',  min: 90 }, { grade: 'A+', min: 80 }, { grade: 'A', min: 70 },
  { grade: 'B+', min: 60 }, { grade: 'B',  min: 50 }, { grade: 'C', min: 40 },
  { grade: 'F',  min: 0  },
]
const GRADE_COLOR = { O:'#ffd700','A+':'#22d3a0',A:'#4a9eff','B+':'#a78bfa',B:'#f5a623',C:'#f05365',F:'#ff4444' }

function assignGrade(v) {
  if (v == null) return 'N/A'
  const n = parseFloat(v)
  for (const { grade, min } of GRADE_BANDS) if (n >= min) return grade
  return 'F'
}

// ── Unlock-reason modal ───────────────────────────────────────
function UnlockReasonModal({ courseCode, onClose, onUnlocked }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const toast = useToast()

  async function submit(e) {
    e.preventDefault()
    if (!reason.trim()) { setErr('Please enter a reason.'); return }
    setSaving(true); setErr('')
    try {
      await coursesApi.unlock(courseCode, { reason: reason.trim() })
      toast.success('Course unlocked. Marks can now be edited.')
      onUnlocked(); onClose()
    } catch (error) {
      setErr(error.response?.data?.detail || error.response?.data?.message || 'Failed to unlock.')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`🔓 Unlock Course — ${courseCode}`} onClose={onClose} width={460}>
      <form onSubmit={submit}>
        <p style={{ color: 'var(--text2)', fontSize: 13.5, marginBottom: 16, lineHeight: 1.6 }}>
          Unlocking allows the faculty to edit marks again. This action is permanently logged with your reason.
        </p>
        <div className="form-group">
          <label className="form-label">Reason for unlock *</label>
          <textarea className="form-input" rows={3} style={{ resize: 'vertical' }}
            value={reason} onChange={e => { setReason(e.target.value); setErr('') }}
            placeholder="e.g. Marks entry error reported by faculty…" required autoFocus />
        </div>
        {err && <div className="alert alert-error" style={{ marginBottom: 12, padding: '10px 14px', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !reason.trim()}>
            {saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Unlocking…</> : '🔓 Unlock'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Shared layout helpers ─────────────────────────────────────
function ColHead({ children, cols }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '9px 14px',
      background: 'var(--surface2)', fontSize: 11, fontWeight: 600, letterSpacing: 1,
      textTransform: 'uppercase', color: 'var(--text3)',
    }}>{children}</div>
  )
}

function DataRow({ cols, children, highlight }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 14px', alignItems: 'center',
      borderTop: '1px solid var(--border)', background: highlight || undefined,
    }}>{children}</div>
  )
}

function Pill({ label, val, color }) {
  return (
    <span style={{ fontSize: 13 }}>
      <span style={{ color: 'var(--text3)' }}>{label}: </span>
      <strong style={{ color: color || 'var(--text)' }}>{val}</strong>
    </span>
  )
}

// ══ Main ══════════════════════════════════════════════════════
export default function CourseDetail() {
  const { code } = useParams()
  const navigate = useNavigate()
  const toast    = useToast()
  const { user } = useAuth()
  const [course, setCourse]           = useState(null)
  const [components, setComponents]   = useState([])
  const [students, setStudents]       = useState([])
  const [tab, setTab]                 = useState('overview')
  const [activeComp, setActiveComp]   = useState(null)
  const [loading, setLoading]         = useState(true)
  const [unlockModal, setUnlockModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, compRes, stuRes] = await Promise.all([
        coursesApi.get(code),
        coursesApi.components(code),
        coursesApi.students(code),
      ])
      setCourse(cRes.data)
      const comps = compRes.data.results ?? compRes.data
      setComponents(comps)
      setActiveComp(comps[0]?.id ?? null)
      setStudents(stuRes.data.results ?? stuRes.data)
    } catch {
      toast.error('Failed to load course data.')
    } finally { setLoading(false) }
  }, [code])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="loading"><div className="spinner" /> Loading course…</div>
  if (!course)  return <div className="alert alert-error">Course not found.</div>

  const TABS = [
    ['overview','▣ Overview'],
    ['enrol',   '⊕ Enrolments'],
    ['marks',   '◈ IA Marks'],
    ['ese',     '⊞ ESE Marks'],
    ['attempts','✎ Exam Attempts'],
  ]

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/courses')}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="text-mono" style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 700 }}>{course.course_code}</span>
            <span className="badge badge-blue">{course.course_type}</span>
            <span className="badge badge-gray">Sem {course.semester}</span>
            <span className="badge badge-gray">{course.academic_year}</span>
            {course.is_submitted
              ? <span className="badge badge-green">✓ Submitted &amp; Locked</span>
              : <span className="badge badge-amber">Draft Mode</span>}
            {course.is_deprecated && (
              <span className="badge badge-gray" style={{ background:'var(--surface2)', color:'var(--text3)', border:'1px solid var(--border)' }}>
                ⚠ Deprecated
              </span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{course.course_name}</div>
              <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 2 }}>
                {students.length} enrolled · {course.credits} credits · IA {course.int_weightage}% / ESE {course.ese_weightage}%
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {user?.role === 'admin' && course.is_submitted && (
                <button className="btn btn-primary btn-sm" onClick={() => setUnlockModal(true)}>
                  🔓 Unlock Course
                </button>
              )}
              {user?.role === 'faculty' && !course.is_submitted && (
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  if (!window.confirm('Submit marks to admin? Changes will be locked.')) return
                  try {
                    await coursesApi.submit(course.course_code)
                    setCourse(prev => ({ ...prev, is_submitted: true }))
                    toast.success('Course submitted.')
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to submit.')
                  }
                }}>⇪ Submit to Admin</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unlock reason modal */}
      {unlockModal && (
        <UnlockReasonModal
          courseCode={course.course_code}
          onClose={() => setUnlockModal(false)}
          onUnlocked={() => setCourse(prev => ({ ...prev, is_submitted: false }))}
        />
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 18px', background: 'none', border: 'none',
            color: tab === key ? 'var(--accent)' : 'var(--text3)',
            fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'marks'    && <MarksTab    course={course} components={components} setComponents={setComponents} students={students} activeComp={activeComp} setActiveComp={setActiveComp} toast={toast} />}
      {tab === 'ese'      && <ESETab      course={course} students={students} toast={toast} />}
      {tab === 'attempts' && <ExamAttemptsTab course={course} students={students} components={components} toast={toast} assignGrade={assignGrade} />}
      {tab === 'enrol'    && <EnrolTab    course={course} students={students} setStudents={setStudents} toast={toast} />}
      {tab === 'overview' && <OverviewTab course={course} students={students} components={components} setComponents={setComponents} toast={toast} />}
    </>
  )
}

// ══ IA MARKS TAB ══════════════════════════════════════════════
const IA_ATTEMPT_OPTIONS = [
  { value: 'Regular', label: 'Regular — Attempt #1 (initial marks entry)' },
  { value: 'Makeup',  label: 'Makeup — Attempt #2 (student failed Regular)' },
  { value: 'Backlog', label: 'Backlog — Attempt #3+ (failed Makeup / debarred)' },
]

function MarksTab({ course, components, setComponents, students, activeComp, setActiveComp, toast }) {
  const [marksMap, setMarksMap] = useState({})
  const [savedSet, setSavedSet] = useState(new Set())
  const [saving, setSaving]     = useState(false)
  const [compLoad, setCompLoad] = useState(false)
  const [viewMode, setViewMode] = useState('raw')
  const [attemptType, setAttemptType] = useState('Regular')
  const [scheduledSids, setScheduledSids] = useState(null) // null = no filter (Regular), Set otherwise
  const { user } = useAuth()

  const comp = components.find(c => c.id === activeComp)
  // Faculty can edit freely while course is in draft; admin can always edit
  const canEdit = user?.role === 'admin' || !course.is_submitted

  useEffect(() => {
    if (!activeComp) return
    setCompLoad(true)
    marksApi.list({ component: activeComp, attempt_type: attemptType, page_size: 500 })
      .then(r => {
        const data = r.data.results ?? r.data
        const map = {}, saved = new Set()
        data.forEach(m => {
          map[m.student] = String(m.marks_obtained ?? '')
          if (m.marks_obtained !== null) saved.add(m.student)
        })
        setMarksMap(map); setSavedSet(saved)
      })
      .finally(() => setCompLoad(false))
  }, [activeComp, attemptType])

  // When switching to Makeup/Backlog, fetch scheduled students for that attempt type
  useEffect(() => {
    if (attemptType === 'Regular') {
      setScheduledSids(null)
      return
    }
    examAttemptsApi.list({ course: course.course_code, attempt_type: attemptType, status: 'Scheduled', page_size: 500 })
      .then(res => {
        const data = res.data.results ?? res.data
        const sids = new Set(data.map(a => String(a.student)))
        setScheduledSids(sids)
      })
      .catch(() => setScheduledSids(new Set()))
  }, [attemptType, course])

  // Filter students: for Makeup/Backlog show only those registered for that attempt
  const visibleStudents = scheduledSids !== null
    ? students.filter(s => scheduledSids.has(String(s.student)))
    : students

  const hasOverMax = comp && visibleStudents.some(s => {
    const v = parseFloat(marksMap[s.student])
    return !isNaN(v) && v > parseFloat(comp.max_marks)
  })
  const filledCount = visibleStudents.filter(s => (marksMap[s.student] ?? '') !== '').length

  async function saveAll() {
    if (!comp) return
    if (!canEdit) { toast.error('Course is locked. Ask admin to unlock.'); return }
    setSaving(true)
    const payload = visibleStudents
      .filter(s => (marksMap[s.student] ?? '') !== '')
      .map(s => ({ student: s.student, component: activeComp, marks_obtained: parseFloat(marksMap[s.student]), attempt_type: attemptType }))
    if (!payload.length) { toast.warn('No marks entered.'); setSaving(false); return }
    try {
      const { data } = await marksApi.bulk(payload)
      const saved = new Set(savedSet)
      ;(data.saved ?? []).forEach(e => saved.add(e.student))
      setSavedSet(saved)
      if ((data.errors ?? []).length) {
        const msg = data.errors.map(e => e.errors?.non_field_errors?.[0] || JSON.stringify(e.errors)).join('; ')
        toast.warn(`Saved ${(data.saved??[]).length}, ${data.errors.length} errors: ${msg}`)
      } else {
        toast.success(`✓ ${(data.saved??[]).length} marks saved for "${comp.name}".`)
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.response?.data?.message || 'Save failed.')
    } finally { setSaving(false) }
  }

  const COLS = '36px 110px 130px 1fr 150px 90px'

  async function handleDeleteComp(e, comp) {
    e.stopPropagation()
    if (!window.confirm(`Delete component "${comp.name}"?\nThis will permanently remove all marks entered for it.`)) return
    try {
      await iaApi.delete(comp.id)
      setComponents(prev => prev.filter(c => c.id !== comp.id))
      if (activeComp === comp.id) {
        const next = components.find(c => c.id !== comp.id)
        setActiveComp(next?.id ?? null)
      }
      toast?.success(`Component "${comp.name}" deleted.`)
    } catch (err) {
      toast?.error(err.response?.data?.detail || 'Failed to delete component.')
    }
  }

  return (
    <div className="card">
      {/* ── Attempt Type Selector ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
        padding: '12px 16px', borderRadius: 10,
        background: attemptType === 'Regular' ? 'rgba(74,158,255,.07)'
                  : attemptType === 'Makeup'  ? 'rgba(245,166,35,.07)'
                  : 'rgba(240,83,101,.07)',
        border: `1px solid ${
          attemptType === 'Regular' ? 'rgba(74,158,255,.3)'
        : attemptType === 'Makeup'  ? 'rgba(245,166,35,.3)'
        : 'rgba(240,83,101,.3)'}`,
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
          Attempt Type:
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {IA_ATTEMPT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`btn btn-sm ${attemptType === opt.value
                ? opt.value === 'Regular' ? 'btn-primary'
                : opt.value === 'Makeup'  ? 'btn-warning'
                : 'btn-danger'
                : 'btn-ghost'}`}
              style={{
                fontSize: 12,
                background: attemptType === opt.value
                  ? opt.value === 'Regular' ? 'rgba(74,158,255,.2)'
                  : opt.value === 'Makeup'  ? 'rgba(245,166,35,.2)'
                  : 'rgba(240,83,101,.2)'
                  : undefined,
                color: attemptType === opt.value
                  ? opt.value === 'Regular' ? 'var(--accent)'
                  : opt.value === 'Makeup'  ? 'var(--amber)'
                  : 'var(--red)'
                  : undefined,
                border: attemptType === opt.value
                  ? `1px solid ${opt.value === 'Regular' ? 'rgba(74,158,255,.4)' : opt.value === 'Makeup' ? 'rgba(245,166,35,.4)' : 'rgba(240,83,101,.4)'}`
                  : undefined,
              }}
              onClick={() => setAttemptType(opt.value)}
            >
              {opt.value}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--text3)', flex: 1 }}>
          {IA_ATTEMPT_OPTIONS.find(o => o.value === attemptType)?.label.split('—')[1]?.trim()}
        </span>
        {attemptType !== 'Regular' && (
          <span className={`badge ${attemptType === 'Makeup' ? 'badge-amber' : 'badge-red'}`} style={{ fontSize: 11 }}>
            {attemptType === 'Makeup' ? '⚠ Makeup Attempt' : '⛔ Backlog Attempt'}
          </span>
        )}
      </div>

      {/* Component selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {components.map(c => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:0 }}>
            <button
              className={`btn ${activeComp === c.id ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              style={{ borderRadius: '6px 0 0 6px', borderRight: 'none' }}
              onClick={() => setActiveComp(c.id)}>
              {c.name} <span style={{ opacity:.6, fontWeight:400 }}>/{c.max_marks}</span>
            </button>
            <button
              className={`btn ${activeComp === c.id ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              style={{
                borderRadius: '0 6px 6px 0', padding: '0 7px', fontSize: 12,
                opacity: 0.6, borderLeft: '1px solid rgba(255,255,255,0.15)',
              }}
              onClick={e => handleDeleteComp(e, c)}
              title={`Delete ${c.name}`}
            >✕</button>
          </div>
        ))}
      </div>

      {comp && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill label="Mode"      val={comp.mode} />
          <Pill label="Max"       val={comp.max_marks} />
          <Pill label="Weightage" val={`${comp.weightage}%`} />
          <Pill label="Filled"    val={`${filledCount}/${visibleStudents.length}`}
            color={filledCount === visibleStudents.length ? 'var(--green)' : undefined} />
          {scheduledSids !== null && (
            <span className={`badge badge-amber`} style={{ fontSize: 11 }}>
              ⚑ {visibleStudents.length} registered for {attemptType}
            </span>
          )}
          {hasOverMax && <span className="badge badge-red">⚠ Marks exceed max</span>}
          {/* View toggle */}
          <div style={{ display:'flex', background:'var(--surface2)', borderRadius:6, padding:3, marginLeft: 16 }}>
            <button className={`btn btn-sm ${viewMode==='raw'?'btn-primary':'btn-ghost'}`} onClick={() => setViewMode('raw')} style={{ minHeight:28, height:28, padding:'0 10px' }}>Raw</button>
            <button className={`btn btn-sm ${viewMode==='scaled'?'btn-primary':'btn-ghost'}`} onClick={() => setViewMode('scaled')} style={{ minHeight:28, height:28, padding:'0 10px' }}>Scaled ({comp.weightage}%)</button>
          </div>
          {course.is_submitted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 8,
              background: user?.role === 'admin' ? 'rgba(245,166,35,0.12)' : 'rgba(240,83,101,0.12)',
              border: `1px solid ${user?.role === 'admin' ? 'var(--amber)' : 'var(--red)'}`,
              fontSize: 12.5, fontWeight: 500,
              color: user?.role === 'admin' ? 'var(--amber)' : 'var(--red)',
            }}>
              🔒 {user?.role === 'admin' ? 'Submitted — you can still edit' : 'Locked — ask admin to unlock'}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <ExportButton
              title={`${course.course_code} - ${comp.name} Marks`}
              filenamePrefix={`${course.course_code}_${comp.name}`}
              dataRows={visibleStudents.map((s, i) => ({
                idx: i+1, jlu: s.student_jlu_id, roll: s.student_roll, name: s.student_name,
                marks: marksMap[s.student] ?? '', saved: savedSet.has(s.student) ? 'Yes' : 'No'
              }))}
              availableCols={[
                { key: 'idx', label: '#' }, { key: 'jlu', label: 'JLU ID' }, { key: 'roll', label: 'Roll No' },
                { key: 'name', label: 'Name' }, { key: 'marks', label: `Marks (/${comp.max_marks})` }, { key: 'saved', label: 'Saved' }
              ]}
              courseInfo={{ code: course.course_code, name: course.course_name }}
            />
            <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={saving || hasOverMax || !canEdit}>
              {saving ? <><span className="spinner" style={{ width:12,height:12 }}/> Saving…</> : '⇪ Save All'}
            </button>
          </div>
        </div>
      )}
      {!comp && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={saving || hasOverMax || !canEdit}>
            {saving ? <><span className="spinner" style={{ width:12,height:12 }}/> Saving…</> : '⇪ Save All'}
          </button>
        </div>
      )}

      {compLoad
        ? <div className="loading" style={{ padding: 32 }}><div className="spinner" /></div>
        : (
          <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            <ColHead cols={COLS}>
              <div>#</div><div>Roll No</div><div>JLU ID</div><div>Name</div>
              <div>{viewMode==='raw' ? `Marks (/${comp?.max_marks})` : `Scaled (${comp?.weightage}%)`}</div>
              <div>Status</div>
            </ColHead>
            {visibleStudents.map((enr, idx) => {
              const sid   = enr.student
              const val   = marksMap[sid] ?? ''
              const saved = savedSet.has(sid)
              const isOver = comp && val !== '' && parseFloat(val) > parseFloat(comp.max_marks)
              return (
                <DataRow key={sid} cols={COLS} highlight={isOver ? 'rgba(240,83,101,.04)' : undefined}>
                  <div style={{ color:'var(--text3)', fontSize:12 }}>{idx+1}</div>
                  <div><span className="text-mono" style={{ fontSize:12, color:'var(--text2)' }}>{enr.student_roll}</span></div>
                  <div><span className="text-mono" style={{ fontSize:12, color:'var(--text3)' }}>{enr.student_jlu_id}</span></div>
                  <div style={{ fontSize:13.5 }}>{enr.student_name}</div>
                  <div>
                    {viewMode === 'raw' ? (
                      <input type="number" min="0" max={comp?.max_marks??100} step="0.5"
                        className={`marks-input${saved?' saved':''}`}
                        style={isOver ? { borderColor:'var(--red)', color:'var(--red)' } : {}}
                        value={val}
                        disabled={!canEdit}
                        onChange={e => {
                          setMarksMap(m => ({ ...m, [sid]: e.target.value }))
                          setSavedSet(s => { const n = new Set(s); n.delete(sid); return n })
                        }}
                        placeholder="—" />
                    ) : (
                      <div className="text-mono" style={{ padding:'8px 12px', fontWeight:600, color: val ? 'var(--text)' : 'var(--text3)' }}>
                        {val ? ((parseFloat(val)/comp.max_marks)*comp.weightage).toFixed(2) : '—'}
                      </div>
                    )}
                  </div>
                  <div>
                    {saved ? <span className="badge badge-green">✓</span>
                           : val ? <span className="badge badge-amber">Unsaved</span>
                                 : <span className="badge badge-gray">Empty</span>}
                  </div>
                </DataRow>
              )
            })}
            {!students.length && <div className="empty-state"><p>No students enrolled.</p></div>}
          </div>
        )}
    </div>
  )
}

// ══ ESE MARKS TAB ═════════════════════════════════════════════
const ESE_STATUS_OPTIONS = [
  { value: 'Appeared',   label: 'Appeared',              disablesMarks: false },
  { value: 'Absent',     label: 'Absent',                disablesMarks: true  },
  { value: 'Withheld',   label: 'Withheld',              disablesMarks: true  },
  { value: 'UFM',        label: 'UFM (Unfair Means)',     disablesMarks: true  },
  { value: 'Cancelled',  label: 'Cancelled',             disablesMarks: true  },
  { value: 'Detained',   label: 'Detained',              disablesMarks: true  },
  { value: 'Debarred',   label: 'Debarred',              disablesMarks: true  },
  { value: 'Medical',    label: 'Medical Leave',         disablesMarks: true  },
]

function ESETab({ course, students, toast }) {
  const [rsMap, setRsMap]         = useState({})
  const [savedSet, setSaved]      = useState(new Set())
  const [loading, setLoading]     = useState(true)
  const [computing, setComp]      = useState(false)
  const [eseAttemptType, setEseAttemptType] = useState('Regular')
  const [scheduledSids, setScheduledSids]   = useState(null) // null = not yet loaded
  const [attemptEseMap, setAttemptEseMap]   = useState({})   // sid → ese_marks from ExamAttempt
  const { user } = useAuth()

  const canEdit = user?.role === 'admin' || !course.is_submitted

  const nameOf = Object.fromEntries(students.map(s => [s.student, s.student_name]))
  const rollOf = Object.fromEntries(students.map(s => [s.student, s.student_roll]))
  const jluOf  = Object.fromEntries(students.map(s => [s.student, s.student_jlu_id]))

  // Load result sheets once
  useEffect(() => {
    resultsApi.list({ course: course.course_code, page_size: 500 })
      .then(rRes => {
        const data = rRes.data.results ?? rRes.data
        const map = {}, saved = new Set()
        data.forEach(rs => {
          map[rs.id] = {
            id: rs.id, sid: rs.student,
            jlu:  jluOf[rs.student]  ?? rs.student_jlu_id,
            roll: rollOf[rs.student] ?? rs.student_roll,
            name: nameOf[rs.student] ?? '',
            ese: String(rs.ese_marks ?? ''),
            attemptStatus: rs.ese_marks != null ? 'Appeared' : '',
          }
          if (rs.ese_marks !== null) saved.add(rs.id)
        })
        setRsMap(map); setSaved(saved)
      })
      .finally(() => setLoading(false))
  }, [course])

  // When attempt type tab changes, load the scheduled students AND their
  // existing ExamAttempt ESE marks (so we show per-attempt values, not the
  // ResultSheet's active ese_marks which may belong to a different attempt).
  useEffect(() => {
    examAttemptsApi
      .list({ course: course.course_code, attempt_type: eseAttemptType, page_size: 500 })
      .then(res => {
        const data = res.data.results ?? res.data
        // Scheduled = registered but exam not yet taken → show for entry
        const sids = new Set(
          data
            .filter(a => ['Scheduled', 'Appeared', 'Pass', 'Fail', 'Absent', 'Withheld'].includes(a.status))
            .map(a => String(a.student))
        )
        setScheduledSids(sids)
        // Build per-attempt ESE map so the tab shows the correct attempt's marks
        const emap = {}
        data.forEach(a => { emap[String(a.student)] = a.ese_marks })
        setAttemptEseMap(emap)
        // Pre-fill rsMap ese values with the attempt-specific marks
        setRsMap(prev => {
          const next = { ...prev }
          Object.values(next).forEach(row => {
            const attemptEse = emap[String(row.sid)]
            next[row.id] = {
              ...row,
              ese: attemptEse != null ? String(attemptEse) : '',
              attemptStatus: attemptEse != null ? 'Appeared' : row.attemptStatus,
            }
          })
          return next
        })
      })
      .catch(() => setScheduledSids(new Set()))
  }, [eseAttemptType, course])

  async function saveOne(rsId) {
    const e = rsMap[rsId]
    const statusCfg = ESE_STATUS_OPTIONS.find(o => o.value === e?.attemptStatus)
    if (!e?.attemptStatus) { toast.warn('Select a sitting status first.'); return }
    if (!statusCfg?.disablesMarks && !e.ese) { toast.warn('Enter a mark first.'); return }
    const payload = statusCfg?.disablesMarks 
      ? { ese_marks: null, attempt_type: eseAttemptType, sitting_status: e.attemptStatus } 
      : { ese_marks: parseFloat(e.ese), attempt_type: eseAttemptType, sitting_status: e.attemptStatus }
    try {
      await resultsApi.enterESE(rsId, payload)
      setSaved(s => new Set([...s, rsId]))
      toast.success(`✓ ESE saved for ${e.name || e.roll}.`)
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed.') }
  }

  async function saveAll() {
    const rows = Object.values(rsMap).filter(e => e.attemptStatus)
    if (!rows.length) { toast.warn('No sitting statuses selected.'); return }
    let ok = 0, fail = 0
    await Promise.all(rows.map(async e => {
      const statusCfg = ESE_STATUS_OPTIONS.find(o => o.value === e.attemptStatus)
      const payload = statusCfg?.disablesMarks 
        ? { ese_marks: null, attempt_type: eseAttemptType, sitting_status: e.attemptStatus } 
        : { ese_marks: parseFloat(e.ese), attempt_type: eseAttemptType, sitting_status: e.attemptStatus }
      try { await resultsApi.enterESE(e.id, payload); setSaved(s => new Set([...s, e.id])); ok++ }
      catch { fail++ }
    }))
    fail ? toast.warn(`Saved ${ok}, failed ${fail}.`) : toast.success(`✓ ESE saved for ${ok} students.`)
  }

  async function computeAll() {
    setComp(true)
    try { await resultsApi.computeAll(course.course_code); toast.success('✓ Grand totals recomputed.') }
    catch { toast.error('Recompute failed.') }
    finally { setComp(false) }
  }

  if (loading) return <div className="loading" style={{ padding: 48 }}><div className="spinner" /></div>

  const rows = Object.values(rsMap)
  // Show only students who are registered for this attempt type.
  // scheduledSids is null only on first render before the effect runs;
  // after load it is a Set (possibly empty for attempt types with no registrations).
  const eligibleRows   = scheduledSids !== null
    ? rows.filter(e => scheduledSids.has(String(e.sid)))
    : rows   // fallback: show all while loading
  const COLS = '36px 110px 130px 1fr 130px 130px 60px'

  return (
    <div className="card">
      {/* ── ESE Attempt Type Selector ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
        padding: '12px 16px', borderRadius: 10,
        background: eseAttemptType === 'Regular' ? 'rgba(74,158,255,.07)'
                  : eseAttemptType === 'Makeup'  ? 'rgba(245,166,35,.07)'
                  : 'rgba(240,83,101,.07)',
        border: `1px solid ${
          eseAttemptType === 'Regular' ? 'rgba(74,158,255,.3)'
        : eseAttemptType === 'Makeup'  ? 'rgba(245,166,35,.3)'
        : 'rgba(240,83,101,.3)'}`,
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
          ESE Attempt:
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {IA_ATTEMPT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className="btn btn-sm btn-ghost"
              style={{
                fontSize: 12,
                background: eseAttemptType === opt.value
                  ? opt.value === 'Regular' ? 'rgba(74,158,255,.2)'
                  : opt.value === 'Makeup'  ? 'rgba(245,166,35,.2)'
                  : 'rgba(240,83,101,.2)'
                  : undefined,
                color: eseAttemptType === opt.value
                  ? opt.value === 'Regular' ? 'var(--accent)'
                  : opt.value === 'Makeup'  ? 'var(--amber)'
                  : 'var(--red)'
                  : undefined,
                border: eseAttemptType === opt.value
                  ? `1px solid ${opt.value === 'Regular' ? 'rgba(74,158,255,.4)' : opt.value === 'Makeup' ? 'rgba(245,166,35,.4)' : 'rgba(240,83,101,.4)'}`
                  : undefined,
              }}
              onClick={() => setEseAttemptType(opt.value)}
            >
              {opt.value}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--text3)', flex: 1 }}>
          {eseAttemptType === 'Regular' ? 'Default for first-time ESE entry'
         : eseAttemptType === 'Makeup'  ? 'Used if student failed Regular attempt'
         : 'Used if student failed Makeup or was debarred'}
        </span>
        {eseAttemptType !== 'Regular' && (
          <span className={`badge ${eseAttemptType === 'Makeup' ? 'badge-amber' : 'badge-red'}`} style={{ fontSize: 11 }}>
            {eseAttemptType === 'Makeup' ? '⚠ Makeup ESE' : '⛔ Backlog ESE'}
          </span>
        )}
      </div>

      {/* Banner when no students registered for this attempt type */}
      {scheduledSids !== null && eligibleRows.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          marginBottom: 20, borderRadius: 10,
          background: 'rgba(245,166,35,.07)', border: '1px solid rgba(245,166,35,.25)',
        }}>
          <span style={{ fontSize: 22 }}>⚑</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 14 }}>No Students Registered</div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>
              {eseAttemptType === 'Regular'
                ? 'No students have been registered for Attempt 1 yet. Go to the Exam Attempts tab and register them first.'
                : `No students are registered for a ${eseAttemptType} attempt. Register failing students via the Exam Attempts tab.`}
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div className="card-title">ESE Marks Entry</div>
          <div className="card-subtitle">
            {course.ese_mode} · Max {course.ese_max_marks} · {course.ese_duration_hrs}h ·{' '}
            <span style={{ color: eligibleRows.length > 0 ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>
              {eligibleRows.length} registered for {eseAttemptType}
            </span>
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <ExportButton
            title={`${course.course_code} - ESE Marks (${eseAttemptType})`}
            filenamePrefix={`${course.course_code}_ESE_${eseAttemptType}`}
            dataRows={eligibleRows.map((e, i) => ({
              idx: i+1, jlu: e.jlu, roll: e.roll, name: e.name, ese: e.ese,
              status: e.attemptStatus, saved: savedSet.has(e.id) ? 'Yes' : 'No'
            }))}
            availableCols={[
              { key:'idx', label:'#' }, { key:'jlu', label:'JLU ID' }, { key:'roll', label:'Roll No' },
              { key:'name', label:'Name' }, { key:'ese', label:'ESE Marks' }, { key:'status', label:'Status' }, { key:'saved', label:'Saved' }
            ]}
            courseInfo={{ code: course.course_code, name: course.course_name }}
          />
          <button className="btn btn-ghost btn-sm" onClick={saveAll} disabled={!canEdit}>⇪ Save All</button>
          <button className="btn btn-ghost btn-sm" onClick={computeAll} disabled={computing || !canEdit}>
            {computing ? <span className="spinner" style={{ width:12,height:12 }}/> : '⟳'} Recompute
          </button>
        </div>
      </div>

      {eligibleRows.length > 0 && (
        <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          <ColHead cols={COLS}>
            <div>#</div><div>Roll No</div><div>JLU ID</div><div>Name</div>
            <div title="How did this student sit the ESE?">Sitting Status ⓘ</div>
            <div>ESE (/{course.ese_max_marks})</div><div>Saved</div>
          </ColHead>
          {eligibleRows.map((e, i) => {
            const status = e.attemptStatus
            const statusCfg = ESE_STATUS_OPTIONS.find(o => o.value === status)
            const disablesMarks = statusCfg?.disablesMarks ?? true
            return (
              <DataRow key={e.id} cols={COLS} highlight={disablesMarks && status ? 'rgba(245,166,35,.04)' : undefined}>
                <div style={{ color:'var(--text3)', fontSize:12 }}>{i+1}</div>
                <div><span className="text-mono" style={{ fontSize:12, color:'var(--text2)' }}>{e.roll}</span></div>
                <div><span className="text-mono" style={{ fontSize:12, color:'var(--text3)' }}>{e.jlu}</span></div>
                <div style={{ fontSize:13.5 }}>{e.name}</div>
                <div>
                  <select
                    className="form-input"
                    style={{ padding:'5px 8px', fontSize:12, height:34 }}
                    value={status}
                    disabled={!canEdit}
                    onChange={ev => setRsMap(m => ({
                      ...m,
                      [e.id]: { ...m[e.id], attemptStatus: ev.target.value, ese: ESE_STATUS_OPTIONS.find(o => o.value === ev.target.value)?.disablesMarks ? '' : m[e.id].ese }
                    }))}
                  >
                    <option value="">— Select —</option>
                    {ESE_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {/* No max= cap so ESE marks can exceed ese_max_marks */}
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    type="number" min="0" step="0.5"
                    className={`marks-input${savedSet.has(e.id) ? ' saved' : ''}`}
                    value={disablesMarks ? '' : e.ese}
                    disabled={!canEdit || disablesMarks}
                    placeholder={status && disablesMarks ? status : '—'}
                    style={{ width:90, opacity: disablesMarks ? 0.45 : 1 }}
                    onChange={ev => setRsMap(m => ({ ...m, [e.id]: { ...m[e.id], ese: ev.target.value } }))}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={() => saveOne(e.id)} disabled={!canEdit || !status}>
                    Save
                  </button>
                </div>
                <div>
                  {savedSet.has(e.id)
                    ? <span className="badge badge-green">✓</span>
                    : <span className="badge badge-gray">—</span>}
                </div>
              </DataRow>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══ EXAM ATTEMPTS TAB ═════════════════════════════════════════
const ATTEMPT_BADGE = {
  Regular:        { cls: 'badge-blue',  label: 'Attempt 1 — Regular' },
  Makeup:         { cls: 'badge-amber', label: 'Attempt 2 — Makeup' },
  Backlog:        { cls: 'badge-red',   label: 'Attempt 3 — Backlog' },
  SpecialBacklog: { cls: 'badge-red',   label: 'Attempt 4 — Special Backlog' },
}
const STATUS_BADGE_ATT = {
  Scheduled: { cls: 'badge-gray',  icon: '○' },
  Appeared:  { cls: 'badge-blue',  icon: '◉' },
  Absent:    { cls: 'badge-amber', icon: '⊘' },
  Pass:      { cls: 'badge-green', icon: '✓' },
  Fail:      { cls: 'badge-red',   icon: '✕' },
  Withheld:  { cls: 'badge-amber', icon: '⊛' },
  UFM:       { cls: 'badge-red',   icon: '⚠' },
}

// Default thresholds — prefer backend-stored values, fall back to 40% heuristic
function getDefaultThresholds(course) {
  if (course?.ia_pass_min != null) {
    return {
      ia:  parseFloat(course.ia_pass_min),
      ese: parseFloat(course.ese_pass_min),
    }
  }
  const iaMax  = parseFloat(course?.int_weightage ?? 30)
  const eseMax = parseFloat(course?.ese_max_marks ?? 70)
  return {
    ia:  Math.round(iaMax  * 0.4),
    ese: Math.round(eseMax * 0.4),
  }
}

function ThresholdModal({ course, thresholds, onSave, onClose }) {
  const [vals, setVals] = useState({ ...thresholds })
  const iaBound  = parseFloat(course.int_weightage)
  const eseBound = parseFloat(course.ese_max_marks)

  return (
    <Modal title="⚙ Pass/Fail Thresholds" onClose={onClose} width={420}>
      <p style={{ color:'var(--text2)', fontSize:13, marginBottom:18, lineHeight:1.6 }}>
        Set minimum marks to pass each component. Overall pass requires <em>both</em> IA and ESE to pass.
        IA total is out of <strong>{iaBound}</strong>, ESE is out of <strong>{eseBound}</strong>.
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
        {[
          { key:'ia',  label:'IA Pass Threshold',  hint:`min out of ${iaBound}` },
          { key:'ese', label:'ESE Pass Threshold', hint:`min out of ${eseBound}` },
        ].map(({ key, label, hint }) => (
          <div key={key} className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">{label}</label>
            <input
              type="number" min="0" step="0.5"
              className="form-input"
              value={vals[key]}
              onChange={e => setVals(v => ({ ...v, [key]: e.target.value }))}
            />
            <span style={{ fontSize:11, color:'var(--text3)', display:'block', marginTop:3 }}>{hint}</span>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => {
          onSave({ ia: parseFloat(vals.ia) || 0, ese: parseFloat(vals.ese) || 0 })
          onClose()
        }}>Apply</button>
      </div>
    </Modal>
  )
}

function ExamAttemptsTab({ course, students, components, toast, assignGrade }) {
  const [sheets, setSheets]           = useState([])
  const [attempts, setAttempts]       = useState([])
  const [marksData, setMarksData]     = useState({})
  const [backlogMap, setBacklogMap]   = useState({})   // sid → backlog record
  const [pendingTypes, setPendingTypes] = useState({}) // sid → 'Makeup'|'Backlog'
  const [regLoading, setRegLoading]   = useState({})   // sid → true while registering
  const [loading, setLoading]         = useState(true)
  const [registering, setRegistering] = useState(false)
  const [regAllLoading, setRegAllLoading] = useState(false)
  const [thresholdModal, setThresholdModal] = useState(false)
  const [thresholds, setThresholds] = useState(() => {
    try {
      const stored = sessionStorage.getItem(`thresholds_${course.course_code}`)
      return stored ? JSON.parse(stored) : getDefaultThresholds(course)
    } catch { return getDefaultThresholds(course) }
  })
  const { user } = useAuth()

  const nameOf = Object.fromEntries(students.map(s => [s.student, s.student_name]))
  const rollOf = Object.fromEntries(students.map(s => [s.student, s.student_roll]))
  const jluOf  = Object.fromEntries(students.map(s => [s.student, s.student_jlu_id]))

  async function saveThresholds(t) {
    setThresholds(t)
    try { sessionStorage.setItem(`thresholds_${course.course_code}`, JSON.stringify(t)) } catch {}
    try {
      await coursesApi.setThresholds(course.course_code, {
        ia_pass_min:  t.ia,
        ese_pass_min: t.ese,
      })
      toast.success('Thresholds saved.')
      // Reload so pass/fail badges update in real-time
      await load()
    } catch (err) {
      toast.error('Thresholds saved locally but failed on backend: ' + (err?.response?.data?.detail || err.message))
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sheetsRes, attRes, blogsRes, ...marksRes] = await Promise.all([
        resultsApi.list({ course: course.course_code, page_size: 500 }),
        examAttemptsApi.list({ course: course.course_code, page_size: 500 }),
        backlogsApi.list({ course: course.course_code, page_size: 500 }),
        ...components.map(c => marksApi.list({ component: c.id, page_size: 500 }))
      ])
      setSheets(sheetsRes.data.results ?? sheetsRes.data)
      setAttempts(attRes.data.results ?? attRes.data)
      // Build backlog map keyed by student id
      const bData = blogsRes.data.results ?? blogsRes.data
      const bMap = {}
      bData.forEach(b => { bMap[b.student] = b })
      setBacklogMap(bMap)
      const mData = {}
      components.forEach((comp, idx) => {
        const compMarks = marksRes[idx].data.results ?? marksRes[idx].data
        compMarks.forEach(m => {
          if (!mData[m.student]) mData[m.student] = {}
          mData[m.student][comp.id] = m.marks_obtained
        })
      })
      setMarksData(mData)
    } catch { toast.error('Failed to load exam data.') }
    finally { setLoading(false) }
  }, [course, components])

  useEffect(() => { load() }, [load])

  // Bulk-register ALL enrolled students (who have no attempt yet) for Regular attempt
  async function registerAllRegular() {
    const unregisteredSids = students
      .map(s => s.student)
      .filter(sid => !(attemptsPerStudent[sid]?.length))
    if (!unregisteredSids.length) {
      toast.warn('All enrolled students are already registered for an attempt.')
      return
    }
    if (!window.confirm(
      `Register all ${unregisteredSids.length} unregistered student(s) for Regular (Attempt 1)?`
    )) return
    setRegAllLoading(true)
    try {
      const res = await examAttemptsApi.bulkRegister({
        students: unregisteredSids,
        course: course.course_code,
        attempt_type: 'Regular',
        academic_year: course.academic_year,
      })
      const { registered = 0, skipped_duplicate = [] } = res.data
      toast.success(
        `✓ ${registered} student(s) registered for Regular attempt.${
          skipped_duplicate.length ? ` ${skipped_duplicate.length} already registered.` : ''
        }`
      )
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Bulk registration failed.')
    } finally {
      setRegAllLoading(false)
    }
  }

  // Register a student for their next attempt (no marks are reset — all data is preserved)
  async function registerForNextAttempt(sid, attemptType) {
    if (!window.confirm(`Register ${nameOf[sid] || sid} for ${attemptType} attempt?\nAll existing marks are preserved. A new Scheduled attempt will be created.`)) return
    setRegLoading(m => ({ ...m, [sid]: true }))
    try {
      await examAttemptsApi.bulkRegister({
        students: [sid],
        course: course.course_code,
        attempt_type: attemptType,
        academic_year: course.academic_year,
      })
      toast.success(`✓ ${nameOf[sid] || sid} registered for ${attemptType}.`)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Registration failed.')
    } finally {
      setRegLoading(m => ({ ...m, [sid]: false }))
    }
  }

  if (loading) return <div className="loading" style={{ padding: 48 }}><div className="spinner" /></div>

  const attemptsPerStudent = {}
  attempts.forEach(a => {
    if (!attemptsPerStudent[a.student]) attemptsPerStudent[a.student] = []
    attemptsPerStudent[a.student].push(a)
  })

  const iaMax  = Number(course.int_weightage)
  const eseMax = Number(course.ese_max_marks)

  const rows = sheets.map(rs => {
    const sid        = rs.student
    const iaTotal    = rs.int_total   != null ? Number(rs.int_total)   : null
    const eseMarks   = rs.ese_marks   != null ? Number(rs.ese_marks)   : null
    const grandTotal = rs.grand_total != null ? Number(rs.grand_total) : null

    const iaPassing  = iaTotal != null
      ? (rs.ia_pass_status === 'Pass' ? true  : rs.ia_pass_status === 'Fail' ? false : null)
      : null
    const esePassing = rs.ese_pass_status === 'Pass' ? true  : rs.ese_pass_status === 'Fail' ? false : null
    const ovPassing  = grandTotal != null ? grandTotal >= thresholds.overall : null

    // Use the backend's authoritative pass_status from the ResultSheet.
    // The backend computes pass/fail from grand_total only (grand_total >= 40).
    // Individual component thresholds (IA/ESE badges) are informational only.
    let passStatus = 'Pending'
    if (rs.pass_status === 'Pass')       passStatus = 'Pass'
    else if (rs.pass_status === 'Fail')  passStatus = 'Fail'
    else if (rs.pass_status === 'Withheld') passStatus = 'Withheld'
    else if (iaTotal != null && eseMarks != null) passStatus = rs.pass_status || 'Pending'
    else if (iaTotal != null) passStatus = 'ESE Pending'
    else passStatus = 'IA Pending'

    const grade = assignGrade(grandTotal)
    const studentAttempts = (attemptsPerStudent[sid] ?? []).sort((a, b) => a.attempt_no - b.attempt_no)
    const latestAttempt   = studentAttempts[studentAttempts.length - 1]

    // Derive the smart default attempt type for the dropdown
    // Regular → first attempt; Makeup → if failed Regular; Backlog → if failed Makeup/Debarred
    let suggestedType = 'Regular'
    if (latestAttempt) {
      const nextMap = { Regular: 'Makeup', Makeup: 'Backlog', Backlog: 'Backlog' }
      suggestedType = nextMap[latestAttempt.attempt_type] ?? 'Regular'
    }

    return {
      sid, rs, iaTotal, eseMarks, grandTotal, grade,
      iaPassing, esePassing, ovPassing, passStatus,
      studentAttempts, latestAttempt, suggestedType,
      jlu: jluOf[sid] ?? '', roll: rollOf[sid] ?? '', name: nameOf[sid] ?? '',
    }
  })

  const pending = rows.filter(r => r.passStatus.endsWith('Pending')).length
  const passing = rows.filter(r => r.passStatus === 'Pass').length
  const failing = rows.filter(r => r.passStatus === 'Fail').length

  const failingWithoutNext = rows.filter(r => {
    if (r.passStatus !== 'Fail') return false
    const lastAtt = r.latestAttempt
    if (!lastAtt) return false
    const nextTypes = { Regular: 'Makeup', Makeup: 'Backlog', Backlog: 'SpecialBacklog' }
    const nextType = nextTypes[lastAtt.attempt_type]
    if (!nextType) return false
    return !r.studentAttempts.some(a => a.attempt_type === nextType)
  })

  const exportRows = rows.map((r, i) => {
    const row = {
      idx: i+1, jlu: r.jlu, roll: r.roll, name: r.name,
      ia_total: r.iaTotal ?? '', ese: r.eseMarks ?? '', total: r.grandTotal ?? '',
      grade: r.grade, ia_status: r.iaPassing == null ? 'Pending' : r.iaPassing ? 'Pass' : 'Fail',
      ese_status: r.esePassing == null ? 'Pending' : r.esePassing ? 'Pass' : 'Fail',
      overall: r.passStatus,
      attempt: r.latestAttempt ? ATTEMPT_BADGE[r.latestAttempt.attempt_type]?.label : 'None',
    }
    components.forEach(comp => { row[`ia_${comp.id}`] = marksData[r.sid]?.[comp.id] ?? '' })
    return row
  })
  const exportCols = [
    { key:'idx', label:'#' }, { key:'jlu', label:'JLU ID' }, { key:'roll', label:'Roll No' },
    { key:'name', label:'Name' }, { key:'ia_total', label:'IA Total' }, { key:'ese', label:'ESE Marks' },
    { key:'total', label:'Grand Total' }, { key:'grade', label:'Grade' },
    { key:'ia_status', label:'IA Status' }, { key:'ese_status', label:'ESE Status' },
    { key:'overall', label:'Overall Result' }, { key:'attempt', label:'Attempt' },
  ]

  async function registerFailingStudents() {
    if (!window.confirm(`Register ${failingWithoutNext.length} failing student(s) for their next attempt?\nAll existing marks are preserved — only a new Scheduled attempt is created.`)) return

    // Group by next attempt type
    const byType = {}
    failingWithoutNext.forEach(r => {
      const nextTypes = { Regular: 'Makeup', Makeup: 'Backlog', Backlog: 'SpecialBacklog' }
      const nextType = nextTypes[r.latestAttempt.attempt_type]
      if (!byType[nextType]) byType[nextType] = []
      byType[nextType].push(r.sid)
    })

    setRegistering(true)
    try {
      for (const [type, sids] of Object.entries(byType)) {
        await examAttemptsApi.bulkRegister({
          students: sids,
          course: course.course_code,
          attempt_type: type,
          academic_year: course.academic_year,
        })
      }
      toast.success(`✓ Registered ${failingWithoutNext.length} student(s) for their next attempt.`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Registration failed.')
    } finally { setRegistering(false) }
  }

  // Backlog status badge config
  const BACKLOG_BADGE = {
    Active:  { cls: 'badge-red',   icon: '⚠', label: 'Active Backlog' },
    Cleared: { cls: 'badge-green', icon: '✓', label: 'Cleared' },
    Lapsed:  { cls: 'badge-gray',  icon: '○', label: 'Lapsed' },
  }

  // Column widths: # Attempt JLU Roll Name IA ESE IA-Status ESE-Status Overall Grade
  const COLS = '36px 160px 108px 115px 1fr 65px 65px 100px 100px 100px 65px'

  return (
    <div>
      {thresholdModal && (
        <ThresholdModal
          course={course}
          thresholds={thresholds}
          onSave={saveThresholds}
          onClose={() => setThresholdModal(false)}
        />
      )}

      {/* Summary bar */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        {[
          ['Total',   rows.length, ''],
          ['Passing', passing,     'var(--green)'],
          ['Failing', failing,     'var(--red)'],
          ['Pending', pending,     'var(--text3)'],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 18px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1 }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:800, color:c||'var(--text)', marginTop:2 }}>{v}</div>
          </div>
        ))}

        <div style={{
          marginLeft: 'auto', display:'flex', gap:8, alignItems:'center',
          padding:'8px 14px', borderRadius:8,
          background:'var(--surface2)', border:'1px solid var(--border)', fontSize:12,
        }}>
          <span style={{ color:'var(--text3)' }}>Thresholds:</span>
          <span>IA ≥ <strong>{thresholds.ia}</strong><span style={{ color:'var(--text3)', fontSize:10 }}>/{iaMax}</span></span>
          <span style={{ color:'var(--border)' }}>·</span>
          <span>ESE ≥ <strong>{thresholds.ese}</strong><span style={{ color:'var(--text3)', fontSize:10 }}>/{eseMax}</span></span>
          <span style={{ color:'var(--border)' }}>·</span>
          <span>Overall ≥ <strong>{thresholds.overall}</strong><span style={{ color:'var(--text3)', fontSize:10 }}>/100</span></span>
          <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:'2px 8px' }}
            onClick={() => setThresholdModal(true)}>⚙ Edit</button>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <ExportButton
            title={`${course.course_code} - Exam Attempts`}
            filenamePrefix={`${course.course_code}_ExamAttempts`}
            dataRows={exportRows}
            availableCols={exportCols}
            iaComponents={components.map(c => ({ id:c.id, name:c.name, max_marks:c.max_marks, weightage:c.weightage }))}
            courseWeightage={{ int_weightage:course.int_weightage, ese_weightage:course.ese_weightage, ese_max_marks:course.ese_max_marks }}
            courseInfo={{ code: course.course_code, name: course.course_name }}
          />
          {/* Bulk Register All for Regular — only show when some students have no attempt */}
          {students.some(s => !(attemptsPerStudent[s.student]?.length)) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={registerAllRegular}
              disabled={regAllLoading}
              title="Register all enrolled students (with no attempt) for Regular (Attempt 1)"
            >
              {regAllLoading
                ? <><span className="spinner" style={{ width:12,height:12 }}/> Registering…</>
                : `⊕ Register All for Regular`}
            </button>
          )}
          {failingWithoutNext.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={registerFailingStudents} disabled={registering}>
              {registering
                ? <><span className="spinner" style={{ width:12,height:12 }}/> Registering…</>
                : `⊕ Register ${failingWithoutNext.length} for Next Attempt`}
            </button>
          )}
        </div>
      </div>

      <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', overflowX:'auto' }}>
        <ColHead cols={COLS}>
          <div>#</div><div>Attempt</div><div>JLU ID</div><div>Roll</div><div>Name</div>
          <div title={`IA Total out of ${iaMax} (int_weightage)`}>IA /{iaMax}</div>
          <div title={`ESE Marks out of ${eseMax} (ese_max_marks)`}>ESE /{eseMax}</div>
          <div>IA Status</div><div>ESE Status</div><div>Overall</div>
          <div>Grade</div>
        </ColHead>
        {rows.map((r, i) => {
          const isFail = r.passStatus === 'Fail'
          const isPass = r.passStatus === 'Pass'
          const latestAtt = r.latestAttempt
          const backlog   = backlogMap[r.sid]
          const pendingType = pendingTypes[r.sid] ?? r.suggestedType
          const isRegLoading = regLoading[r.sid]

          return (
            <DataRow key={r.rs.id} cols={COLS}
              highlight={isFail ? 'rgba(240,83,101,.04)' : isPass ? 'rgba(34,211,160,.03)' : undefined}>
              <div style={{ color:'var(--text3)', fontSize:12 }}>{i+1}</div>

              {/* ── Attempt column ─────────────────────────────── */}
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {latestAtt ? (
                  /* Student already has an attempt — show badge(s) */
                  <>
                    <span className={`badge ${ATTEMPT_BADGE[latestAtt.attempt_type]?.cls ?? 'badge-gray'}`} style={{ fontSize:10 }}>
                      {ATTEMPT_BADGE[latestAtt.attempt_type]?.label ?? latestAtt.attempt_type}
                    </span>
                    <span className={`badge ${STATUS_BADGE_ATT[latestAtt.status]?.cls ?? 'badge-gray'}`} style={{ fontSize:10 }}>
                      {STATUS_BADGE_ATT[latestAtt.status]?.icon} {latestAtt.status}
                    </span>
                    {/* BMS status badge — shown for Backlog-type attempts */}
                    {latestAtt.attempt_type === 'Backlog' && backlog && (() => {
                      const cfg = BACKLOG_BADGE[backlog.status]
                      return (
                        <span className={`badge ${cfg?.cls ?? 'badge-gray'}`} style={{ fontSize:10, marginTop:1 }}>
                          {cfg?.icon} {cfg?.label ?? backlog.status}
                        </span>
                      )
                    })()}
                    
                    {/* If student failed and has no scheduled next attempt, show Register button */}
                    {isFail && latestAtt.status !== 'Scheduled' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: 9, padding: '2px 6px', height: 20, marginTop: 4,
                          color: 'var(--green)', border: '1px solid rgba(34,211,160,.4)',
                        }}
                        disabled={isRegLoading}
                        onClick={() => registerForNextAttempt(r.sid, r.suggestedType)}
                      >
                        {isRegLoading ? '…' : `⊕ Register → ${r.suggestedType}`}
                      </button>
                    )}
                  </>
                ) : (
                  /* No attempt yet — use the bulk "Register All for Regular" button above */
                  <span
                    className="badge badge-gray"
                    style={{ fontSize:10, opacity:0.75 }}
                    title="Use 'Register All for Regular' button above to register this student"
                  >
                    ○ Not Registered
                  </span>
                )}
              </div>

              <div><span className="text-mono" style={{ fontSize:11, color:'var(--text3)' }}>{r.jlu}</span></div>
              <div><span className="text-mono" style={{ fontSize:11, color:'var(--text2)' }}>{r.roll}</span></div>
              <div style={{ fontSize:13 }}>{r.name}</div>

              {/* IA Total */}
              <div className="text-mono" style={{ fontSize:13,
                color: r.iaPassing === false ? 'var(--red)' : r.iaPassing ? 'var(--green)' : 'var(--text3)' }}>
                {r.iaTotal ?? '—'}
              </div>
              {/* ESE Marks */}
              <div className="text-mono" style={{ fontSize:13,
                color: r.esePassing === false ? 'var(--red)' : r.esePassing ? 'var(--green)' : 'var(--text3)' }}>
                {r.eseMarks ?? '—'}
              </div>

              {/* IA Status badge */}
              <div>
                {r.iaPassing === true  && <span className="badge badge-green" style={{ fontSize:11 }}>✓ IA Pass</span>}
                {r.iaPassing === false && <span className="badge badge-red"   style={{ fontSize:11 }}>✕ IA Fail</span>}
                {r.iaPassing === null  && <span className="badge badge-gray"  style={{ fontSize:11 }}>Pending</span>}
              </div>
              {/* ESE Status badge */}
              <div>
                {r.esePassing === true  && <span className="badge badge-green" style={{ fontSize:11 }}>✓ ESE Pass</span>}
                {r.esePassing === false && <span className="badge badge-red"   style={{ fontSize:11 }}>✕ ESE Fail</span>}
                {r.esePassing === null  && <span className="badge badge-gray"  style={{ fontSize:11 }}>Pending</span>}
              </div>
              {/* Overall Pass/Fail */}
              <div>
                {r.passStatus === 'Pass'        && <span className="badge badge-green" style={{ fontSize:11 }}>✓ Pass</span>}
                {r.passStatus === 'Fail'        && <span className="badge badge-red"   style={{ fontSize:11 }}>✕ Fail</span>}
                {r.passStatus === 'ESE Pending' && <span className="badge badge-amber" style={{ fontSize:11 }}>ESE Pending</span>}
                {r.passStatus === 'IA Pending'  && <span className="badge badge-gray"  style={{ fontSize:11 }}>IA Pending</span>}
                {r.passStatus === 'Pending'     && <span className="badge badge-gray"  style={{ fontSize:11 }}>Pending</span>}
              </div>

              {/* Grade */}
              <div>
                {r.grandTotal != null ? (
                  <span style={{ padding:'3px 8px', borderRadius:6, fontSize:12, fontWeight:700,
                    background:(GRADE_COLOR[r.grade]??'#4d607f')+'22', color:GRADE_COLOR[r.grade]??'var(--text3)' }}>
                    {r.grade}
                  </span>
                ) : <span style={{ color:'var(--text3)' }}>—</span>}
              </div>
            </DataRow>
          )
        })}
        {!rows.length && <div className="empty-state"><p>No result sheets found.</p></div>}
      </div>
    </div>
  )
}
// ══ OVERVIEW TAB ══════════════════════════════════════════════
function OverviewTab({ course, students, components, setComponents, toast }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState({ name:'', mode:'Offline', max_marks:'', weightage:'' })
  const [saving, setSaving] = useState(false)

  const totalWt   = components.reduce((a, c) => a + parseFloat(c.weightage || 0), 0)
  const remaining = parseFloat(course.int_weightage) - totalWt

  async function handleAdd(e) {
    e.preventDefault()
    const newWt = parseFloat(form.weightage)
    if (newWt > remaining + 0.001) {
      toast.error(`Weightage exceeds limit. You can add at most ${remaining.toFixed(2)}% more.`)
      return
    }
    setSaving(true)
    try {
      const { data } = await iaApi.create({
        course: course.course_code, name: form.name, mode: form.mode,
        max_marks: parseFloat(form.max_marks), weightage: newWt
      })
      setComponents(prev => [...prev, data])
      setAdding(false)
      setForm({ name:'', mode:'Offline', max_marks:'', weightage:'' })
      toast?.success('IA Component added.')
    } catch (err) {
      toast?.error(err.response?.data?.message || err.response?.data?.detail || 'Failed to add component.')
    } finally { setSaving(false) }
  }

  async function handleDeleteComp(comp) {
    if (!window.confirm(`Delete component "${comp.name}"? This will permanently remove all marks entered for it.`)) return
    try {
      await iaApi.delete(comp.id)
      setComponents(prev => prev.filter(c => c.id !== comp.id))
      toast?.success(`Component "${comp.name}" deleted.`)
    } catch (err) {
      toast?.error(err.response?.data?.detail || 'Failed to delete component. It may have marks entries — delete those first, or contact your admin.')
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="card">
        <div className="card-title" style={{ marginBottom:16 }}>Course Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
          {[
            ['Course Code', course.course_code], ['Course Name', course.course_name],
            ['Type', course.course_type], ['Academic Year', course.academic_year],
            ['Semester', course.semester], ['Term', course.term],
            ['Credits', course.credits], ['Lecture Hrs', course.lecture_hrs],
            ['Tutorial Hrs', course.tutorial_hrs], ['Practical Hrs', course.practical_hrs],
            ['Total Hrs', course.total_hrs], ['ESE Mode', course.ese_mode],
            ['ESE Max Marks', course.ese_max_marks], ['ESE Duration', `${course.ese_duration_hrs}h`],
            ['IA Weightage', `${course.int_weightage}%`], ['ESE Weightage', `${course.ese_weightage}%`],
            ['Status', course.is_deprecated ? '⚠ Deprecated' : course.is_submitted ? '✓ Submitted' : 'Draft'],
          ].map(([label, val]) => (
            <div key={label} style={{ display:'flex', gap:10, padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ color:'var(--text3)', fontSize:12, minWidth:130 }}>{label}</span>
              <span style={{ fontWeight:600, fontSize:13 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div className="card-title">IA Components ({components.length})</div>
            <div style={{ fontSize:12, marginTop:4,
              color: remaining < 0 ? 'var(--red)' : remaining === 0 ? 'var(--green)' : 'var(--text3)' }}>
              Total: <strong>{totalWt.toFixed(2)}% / {course.int_weightage}%</strong>
              {remaining > 0 && <span> — {remaining.toFixed(2)}% remaining</span>}
              {remaining <= 0 && remaining >= -0.01 && <span> — ✓ Limit reached</span>}
              {remaining < -0.01 && <span> — ⚠ Exceeds limit!</span>}
            </div>
          </div>
          <button className="btn btn-primary btn-sm"
            onClick={() => setAdding(!adding)}
            disabled={remaining <= 0.005 && !adding}>
            {adding ? 'Cancel' : '+ Add Component'}
          </button>
        </div>

        {adding && (
          <form onSubmit={handleAdd} style={{ display:'flex', gap:10, marginBottom:16, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:150 }}>
              <label className="form-label">Name</label>
              <input required className="form-input" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="e.g. Mid-Term" />
            </div>
            <div className="form-group" style={{ marginBottom:0, width:120 }}>
              <label className="form-label">Mode</label>
              <select className="form-input" value={form.mode} onChange={e => setForm({...form, mode:e.target.value})}>
                <option>Offline</option><option>Online</option><option>Certificate</option><option>Hackathon</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0, width:90 }}>
              <label className="form-label">Max Marks</label>
              <input required type="number" min="1" className="form-input" value={form.max_marks} onChange={e => setForm({...form, max_marks:e.target.value})} placeholder="50" />
            </div>
            <div className="form-group" style={{ marginBottom:0, width:130 }}>
              <label className="form-label">Wt % (max {remaining.toFixed(1)})</label>
              <input required type="number" min="0.01" max={remaining} step="0.01" className="form-input"
                value={form.weightage}
                onChange={e => setForm({...form, weightage:e.target.value})}
                placeholder={`≤${remaining.toFixed(0)}`}
                style={parseFloat(form.weightage) > remaining ? { borderColor:'var(--red)' } : {}} />
              {parseFloat(form.weightage) > remaining && (
                <div style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>Exceeds {remaining.toFixed(2)}% remaining</div>
              )}
            </div>
            <button type="submit" className="btn btn-primary"
              disabled={saving || !form.weightage || parseFloat(form.weightage) > remaining}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}

        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Mode</th><th>Max Marks</th><th>Weightage</th><th></th></tr></thead>
            <tbody>{components.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td><span className="badge badge-gray">{c.mode}</span></td>
                <td className="text-mono">{c.max_marks}</td>
                <td>{c.weightage}%</td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color:'var(--red)', padding:'2px 8px', fontSize:12 }}
                    onClick={() => handleDeleteComp(c)}
                    title="Delete component"
                  >✕ Delete</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom:16 }}>Enrolled Students ({students.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>JLU ID</th><th>Roll No</th><th>Name</th><th>Enrolled At</th></tr></thead>
            <tbody>{students.map((s, i) => (
              <tr key={s.student}>
                <td style={{ color:'var(--text3)' }}>{i+1}</td>
                <td><span className="text-mono text-muted">{s.student_jlu_id}</span></td>
                <td><span className="text-mono">{s.student_roll}</span></td>
                <td>{s.student_name}</td>
                <td className="text-muted">{new Date(s.enrolled_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ══ ENROLMENT TAB ═════════════════════════════════════════════
function EnrolTab({ course, students, setStudents, toast }) {
  const [search, setSearch]         = useState('')
  const [searchRes, setSearchRes]   = useState([])
  const [searching, setSearching]   = useState(false)
  const [removing, setRemoving]     = useState(null)
  const [programs, setPrograms]     = useState([])
  const [batchForm, setBatchForm]   = useState({ program:'', semester:'', section:'' })
  const [batchLoading, setBatchLoading] = useState(false)
  const { user } = useAuth()

  const isOE = course.course_type === 'OE'

  useEffect(() => {
    orgApi.programs({ page_size: 200 }).then(r => setPrograms(r.data.results ?? r.data)).catch(() => {})
  }, [])

  const enrolledStudentIds = new Set(students.map(s => String(s.student)))
  const enrolIdMap = Object.fromEntries(students.map(s => [String(s.student), s.id]))


  async function doSearch() {
    const q = search.trim(); if (!q) return
    setSearching(true)
    try { const r = await studentsApi.list({ search: q, page_size: 20 }); setSearchRes(r.data.results ?? r.data) }
    catch { toast.error('Search failed.') }
    finally { setSearching(false) }
  }

  async function enrol(student) {
    // Semester match guard (for non-OE courses)
    if (!isOE && student.semester !== course.semester) {
      toast.error(`Cannot enrol: student is in Semester ${student.semester}, but this course is for Semester ${course.semester}.`)
      return
    }
    try {
      await enrolmentsApi.create({ student: student.student_id, course: course.course_code, academic_year: course.academic_year })
      const updated = await coursesApi.students(course.course_code)
      setStudents(updated.data.results ?? updated.data)
      toast.success(`✓ ${student.user_info?.first_name} ${student.user_info?.last_name} enrolled.`)
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.detail
        || (Array.isArray(e.response?.data) ? e.response.data[0] : null) || 'Enrolment failed.'
      toast.error(msg)
    }
  }

  async function unenrol(studentId, enrolId) {
    if (!enrolId) { toast.error('Could not find enrolment record.'); return }
    if (!window.confirm('Remove this student from the course?')) return
    setRemoving(studentId)
    try {
      await enrolmentsApi.delete(enrolId)
      setStudents(prev => prev.filter(s => s.student !== studentId))
      toast.success('Student removed from course.')
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to remove student.') }
    finally { setRemoving(null) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Batch enrol */}
      {!isOE && (
        <div className="card">
          <div className="card-title" style={{ marginBottom:12 }}>Batch Enrol by Program / Semester</div>
          <div style={{ fontSize:12, color:'var(--amber)', marginBottom:10, padding:'8px 12px', background:'rgba(245,166,35,.08)', borderRadius:8, border:'1px solid rgba(245,166,35,.2)' }}>
            ⚠ Only students currently in Semester {course.semester} of the selected program will be enrolled. Cross-semester enrolment is blocked.
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div className="form-group" style={{ marginBottom:0, minWidth:180 }}>
              <label className="form-label">Program *</label>
              <select className="form-select" value={batchForm.program} onChange={e => setBatchForm({...batchForm, program:e.target.value})}>
                <option value="">Select program…</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.short_name} — {p.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0, width:100 }}>
              <label className="form-label">Semester *</label>
              <select className="form-select" value={batchForm.semester} onChange={e => setBatchForm({...batchForm, semester:e.target.value})}>
                <option value="">Sem</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0, width:80 }}>
              <label className="form-label">Section</label>
              <input className="form-input" value={batchForm.section} onChange={e => setBatchForm({...batchForm, section:e.target.value})} placeholder="All" />
            </div>
            <button className="btn btn-primary btn-sm"
              disabled={batchLoading || !batchForm.program || !batchForm.semester}
              onClick={async () => {
                setBatchLoading(true)
                try {
                  const { data } = await enrolmentsApi.batchEnrol({
                    course: course.course_code, program: parseInt(batchForm.program),
                    semester: parseInt(batchForm.semester),
                    section: batchForm.section || undefined, academic_year: course.academic_year,
                  })
                  toast.success(data.message)
                  const updated = await coursesApi.students(course.course_code)
                  setStudents(updated.data.results ?? updated.data)
                } catch (err) { toast.error(err.response?.data?.detail || 'Batch enrol failed.') }
                finally { setBatchLoading(false) }
              }}>
              {batchLoading ? <><span className="spinner" style={{ width:12,height:12 }}/> Enrolling…</> : '⇪ Batch Enrol'}
            </button>
          </div>
        </div>
      )}

      {/* Individual search */}
      <div className="card">
        <div className="card-title" style={{ marginBottom:16 }}>{isOE ? 'Add Students' : 'Add Individual Student'}</div>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <input className="form-input" placeholder="Search by name, roll no, or JLU ID…"
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()} style={{ flex:1 }} />
          <button className="btn btn-primary btn-sm" onClick={doSearch} disabled={searching}>
            {searching ? <span className="spinner" style={{ width:14,height:14 }}/> : 'Search'}
          </button>
        </div>
        {searchRes.length > 0 && (
          <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            {searchRes.map((s, i) => {
              const already = enrolledStudentIds.has(String(s.student_id))
              const semMismatch = !isOE && s.semester !== course.semester
              return (
                <div key={s.student_id} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'11px 14px',
                  borderTop: i===0 ? 'none' : '1px solid var(--border)',
                  background: already ? 'var(--green-dim)' : semMismatch ? 'rgba(240,83,101,.04)' : undefined,
                }}>
                  <span className="text-mono" style={{ fontSize:12, color:'var(--text3)', minWidth:80 }}>{s.roll_no}</span>
                  <span style={{ flex:1, fontSize:13.5 }}>{s.user_info?.first_name} {s.user_info?.last_name}</span>
                  <span className="badge badge-gray">{s.program_name}</span>
                  <span className="badge badge-gray">Sem {s.semester}</span>
                  {semMismatch && (
                    <span className="badge badge-red" title={`Course requires Sem ${course.semester}`}>Sem mismatch</span>
                  )}
                  {already
                    ? <span className="badge badge-green">✓ Enrolled</span>
                    : semMismatch
                      ? <button className="btn btn-ghost btn-sm" disabled style={{ opacity:.4 }}>Can't enrol</button>
                      : <button className="btn btn-primary btn-sm" onClick={() => enrol(s)}>+ Enrol</button>}
                </div>
              )
            })}
          </div>
        )}
        {searchRes.length === 0 && search && !searching && (
          <div className="empty-state" style={{ padding:24 }}><p>No students found for "{search}".</p></div>
        )}
      </div>

      {/* Enrolled list */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div className="card-title">Currently Enrolled ({students.length})</div>
        </div>
        {students.length === 0
          ? <div className="empty-state"><p>No students enrolled yet.</p></div>
          : (
            <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
              <div style={{
                display:'grid', gridTemplateColumns:'36px 110px 130px 1fr 100px 80px',
                gap:12, padding:'9px 14px', background:'var(--surface2)',
                fontSize:11, fontWeight:600, letterSpacing:1, textTransform:'uppercase', color:'var(--text3)',
              }}>
                <div>#</div><div>JLU ID</div><div>Roll No</div><div>Name</div><div>Enrolled</div><div></div>
              </div>
              {students.map((s, i) => (
                <div key={s.student} style={{
                  display:'grid', gridTemplateColumns:'36px 110px 130px 1fr 100px 80px',
                  gap:12, padding:'10px 14px', alignItems:'center', borderTop:'1px solid var(--border)',
                }}>
                  <div style={{ color:'var(--text3)', fontSize:12 }}>{i+1}</div>
                  <div><span className="text-mono" style={{ fontSize:12, color:'var(--text3)' }}>{s.student_jlu_id}</span></div>
                  <div><span className="text-mono" style={{ fontSize:12, color:'var(--text2)' }}>{s.student_roll}</span></div>
                  <div style={{ fontSize:13.5 }}>{s.student_name}</div>
                  <div style={{ fontSize:12, color:'var(--text3)' }}>
                    {s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString('en-IN') : '—'}
                  </div>
                  <div>
                    <button className="btn btn-danger btn-sm" disabled={removing===s.student}
                      onClick={() => unenrol(s.student, enrolIdMap[String(s.student)])}
                      style={{ fontSize:11 }}>
                      {removing===s.student ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}
