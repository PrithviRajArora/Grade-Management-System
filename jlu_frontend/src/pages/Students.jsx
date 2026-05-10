import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { students as studentsApi } from '../api'
import { useToast } from '../context/ToastContext'
import { SkeletonTable } from '../components/Skeleton'

export default function Students() {
  const navigate = useNavigate()
  const toast    = useToast()
  const [list, setList]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)
  const PAGE_SIZE = 50

  useEffect(() => {
    setLoading(true)
    studentsApi.list({ search, page })
      .then(r => {
        setList(r.data.results ?? r.data)
        setTotal(r.data.count ?? (r.data.results ?? r.data).length)
      })
      .catch(() => toast.error('Failed to load students.'))
      .finally(() => setLoading(false))
  }, [search, page])

  function handleSearch(e) {
    setSearch(e.target.value)
    setPage(1)
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Students</div>
        <div className="page-desc">{total} students registered</div>
      </div>

      <div className="card">
        <div className="card-header">
          <input
            className="form-input"
            style={{ maxWidth: 320 }}
            placeholder="Search by name, roll no, ID…"
            value={search}
            onChange={handleSearch}
          />
        </div>

        {loading
          ? <div className="loading"><div className="spinner" /></div>
          : list.length === 0
            ? <div className="empty-state"><div className="icon">◉</div><p>No students found.</p></div>
            : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>JLU ID</th>
                        <th>Roll No</th>
                        <th>Name</th>
                        <th>Program</th>
                        <th>Sem</th>
                        <th>Section</th>
                        <th>Year</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(s => (
                        <tr key={s.student_id}>
                          <td><span className="text-mono" style={{ color: 'var(--accent)' }}>{s.student_id}</span></td>
                          <td><span className="text-mono text-muted">{s.user_info?.jlu_id}</span></td>
                          <td><span className="text-mono">{s.roll_no}</span></td>
                          <td>{s.user_info?.first_name} {s.user_info?.last_name}</td>
                          <td>{s.program_name}</td>
                          <td>Sem {s.semester}</td>
                          <td>{s.section ?? '—'}</td>
                          <td className="text-muted">{s.academic_year}</td>
                          <td>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => navigate(`/students/${s.student_id}`)}
                            >
                              Report →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {total > PAGE_SIZE && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Prev</button>
                    <span style={{ alignSelf: 'center', color: 'var(--text3)', fontSize: 13 }}>
                      Page {page} of {Math.ceil(total / PAGE_SIZE)}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total}>Next →</button>
                  </div>
                )}
              </>
            )
        }
      </div>
    </>
  )
}
