import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { courses as coursesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { SkeletonTable } from '../components/Skeleton'

const TYPE_COLORS = {
  Core: 'badge-blue', Foundation: 'badge-green', MD: 'badge-amber',
  SEC: 'badge-gray', AECC: 'badge-gray', OE: 'badge-gray',
}

export default function Courses() {
  const { user }       = useAuth()
  const navigate       = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    const params = {}
    if (user?.role === 'faculty') params.faculty = user.profile_id
    coursesApi.list(params)
      .then(r => setList(r.data.results ?? r.data))
      .finally(() => setLoading(false))
  }, [user])

  const filtered = list.filter(c =>
    c.course_code.toLowerCase().includes(search.toLowerCase()) ||
    c.course_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <>
      <div className="page-header"><div className="page-title">Courses</div></div>
      <SkeletonTable rows={6} cols={7} />
    </>
  )

  return (
    <>
      <div className="page-header">
        <div className="page-title">{user?.role === 'faculty' ? 'My Courses' : 'All Courses'}</div>
        <div className="page-desc">{list.length} course{list.length !== 1 ? 's' : ''} found</div>
      </div>

      <div className="card">
        <div className="card-header">
          <input
            className="form-input"
            style={{ maxWidth: 320 }}
            placeholder="Search by code or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0
          ? <div className="empty-state"><div className="icon">◈</div><p>No courses found.</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Course Name</th>
                    <th>Type</th>
                    <th>Sem</th>
                    <th>Credits</th>
                    <th>ESE Mode</th>
                    <th>Weightage</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.course_code}>
                      <td><span className="text-mono" style={{ color: 'var(--accent)' }}>{c.course_code}</span></td>
                      <td>{c.course_name}</td>
                      <td><span className={`badge ${TYPE_COLORS[c.course_type] ?? 'badge-gray'}`}>{c.course_type}</span></td>
                      <td>Sem {c.semester}</td>
                      <td>{c.credits} cr</td>
                      <td><span className="badge badge-gray">{c.ese_mode}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        IA {c.int_weightage}% / ESE {c.ese_weightage}%
                      </td>
                      <td>
                        {c.is_deprecated
                          ? <span className="badge badge-gray" style={{ fontSize: 10 }}>⚠ Deprecated</span>
                          : c.is_submitted
                            ? <span className="badge badge-green" style={{ fontSize: 10 }}>🔒 Locked</span>
                            : <span className="badge badge-amber" style={{ fontSize: 10 }}>Draft</span>
                        }
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/courses/${c.course_code}`)}
                        >
                          Open →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </>
  )
}
