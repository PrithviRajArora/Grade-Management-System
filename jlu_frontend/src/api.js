import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach access token
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/refresh/', { refresh })
          localStorage.setItem('access', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      } else {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  login:          data   => api.post('/auth/login/', data),
  me:             ()     => api.get('/users/me/'),
  changePassword: data   => api.post('/users/change_password/', data),
}

// ── Users ─────────────────────────────────────────────────────
export const users = {
  update:        (id, data) => api.patch(`/users/${id}/`, data),
  resetPassword: (id, data) => api.post(`/users/${id}/reset_password/`, data),
}

// ── Org hierarchy ─────────────────────────────────────────────
export const org = {
  facultyOf:       params => api.get('/faculty-of/', { params }),
  createFacultyOf: data   => api.post('/faculty-of/', data),
  deleteFacultyOf: id     => api.delete(`/faculty-of/${id}/`),
  schools:         params => api.get('/schools/',    { params }),
  createSchool:    data   => api.post('/schools/',    data),
  deleteSchool:    id     => api.delete(`/schools/${id}/`),
  programs:        params => api.get('/programs/',   { params }),
  createProgram:   data   => api.post('/programs/',   data),
  deleteProgram:   id     => api.delete(`/programs/${id}/`),
}

// ── Faculty ───────────────────────────────────────────────────
export const faculty = {
  list:   params => api.get('/faculty/',       { params }),
  get:    id     => api.get(`/faculty/${id}/`),
  create: data   => api.post('/faculty/',       data),
  update: (id,d) => api.patch(`/faculty/${id}/`, d),
  delete: id     => api.delete(`/faculty/${id}/`),
  nextId: ()     => api.get('/faculty/next_id/'),
}

// ── Students ──────────────────────────────────────────────────
export const students = {
  list:    params => api.get('/students/',      { params }),
  get:     id     => api.get(`/students/${id}/`),
  create:  data   => api.post('/students/',      data),
  update:  (id,d) => api.patch(`/students/${id}/`, d),
  delete:  id     => api.delete(`/students/${id}/`),
  results: id     => api.get(`/students/${id}/results/`),
  marks:   id     => api.get(`/students/${id}/marks/`),
  nextId:  ()     => api.get('/students/next_id/'),
}

// ── Courses (CCR) ─────────────────────────────────────────────
export const courses = {
  list:       params => api.get('/ccr/',              { params }),
  get:        code   => api.get(`/ccr/${code}/`),
  create:     data   => api.post('/ccr/',              data),
  update:         (code,d)=> api.patch(`/ccr/${code}/`,   d),
  setThresholds:  (code,d)=> api.patch(`/ccr/${code}/set_thresholds/`, d),
  delete:     (code, data) => api.delete(`/ccr/${code}/`, { data }),
  students:   code   => api.get(`/ccr/${code}/enrolled_students/`),
  components: code   => api.get(`/ccr/${code}/ia_components/`),
  submit:     code   => api.post(`/ccr/${code}/submit/`),
  unlock:     (code, data) => api.post(`/ccr/${code}/unlock/`, data),
  unlockBulk: data         => api.post('/ccr/unlock_bulk/', data),
}

// ── IA Components ─────────────────────────────────────────────
export const iaComponents = {
  list:   params => api.get('/ia-components/',      { params }),
  create: data   => api.post('/ia-components/',      data),
  update: (id,d) => api.patch(`/ia-components/${id}/`, d),
  delete: id     => api.delete(`/ia-components/${id}/`),
}

// ── Enrolments ────────────────────────────────────────────────
export const enrolments = {
  list:             params     => api.get('/enrolments/', { params }),
  create:           data       => api.post('/enrolments/', data),
  delete:           id         => api.delete(`/enrolments/${id}/`),
  batchEnrol:       data       => api.post('/enrolments/batch_enrol/', data),
  setEseEligible:   (id, flag) => api.patch(`/enrolments/${id}/`, { ese_eligible: flag }),
  batchSetEligible: data       => api.post('/enrolments/batch_ese_eligible/', data),
}

// ── Marks ─────────────────────────────────────────────────────
export const marks = {
  list:   params => api.get('/marks/',             { params }),
  bulk:   data   => api.post('/marks/bulk_enter/', data),
  update: (id,d) => api.patch(`/marks/${id}/`,     d),
  delete: id     => api.delete(`/marks/${id}/`),
}

// ── Results ───────────────────────────────────────────────────
export const results = {
  list:              params => api.get('/result-sheets/',              { params }),
  enterESE:          (id,d) => api.post(`/result-sheets/${id}/enter_ese/`, d),
  computeAll:        course => api.post(`/result-sheets/compute_all/?course=${course}`),
  resetForReattempt: (id,d) => api.post(`/result-sheets/${id}/reset_for_reattempt/`, d),
  batchReset:        data   => api.post('/result-sheets/batch_reset/', data),
  compute:           (id,d) => api.post(`/result-sheets/${id}/compute/`, d ?? {}),
}

// ── Analytics ─────────────────────────────────────────────────
export const analytics = {
  dashboard:     ()          => api.get('/analytics/dashboard/'),
  courseSummary: params      => api.get('/analytics/course_summary/', { params }),
  gradeDist:     params      => api.get('/analytics/grade_distribution/', { params }),
  toppers:       (params, n=10) => api.get('/analytics/toppers/', { params: { ...params, limit: n } }),
  studentReport: id          => api.get(`/analytics/student_report/?student=${id}`),
  iaBreakdown:   params      => api.get('/analytics/ia_breakdown/', { params }),
}

// ── Exam Attempts ─────────────────────────────────────────
export const examAttempts = {
  list:           params => api.get('/exam-attempts/',                    { params }),
  get:            id     => api.get(`/exam-attempts/${id}/`),
  create:         data   => api.post('/exam-attempts/',                    data),
  update:         (id,d) => api.patch(`/exam-attempts/${id}/`,             d),
  delete:         id     => api.delete(`/exam-attempts/${id}/`),
  bulkRegister:   data   => api.post('/exam-attempts/bulk_register/',      data),
  bulkResults:    data   => api.post('/exam-attempts/bulk_results/',       data),
  studentHistory: id     => api.get(`/exam-attempts/student_history/?student=${id}`),
}

// ── Backlogs ──────────────────────────────────────────────
export const backlogs = {
  list:    params => api.get('/backlogs/',              { params }),
  get:     id     => api.get(`/backlogs/${id}/`),
  summary: params => api.get('/backlogs/summary/',      { params }),
  clear:   (id,d) => api.post(`/backlogs/${id}/clear/`, d ?? {}),
  lapse:   id     => api.post(`/backlogs/${id}/lapse/`),
}

// ── Exam Stats ────────────────────────────────────────────
export const examStats = {
  list:           params => api.get('/exam-stats/',                  { params }),
  refresh:        params => api.post('/exam-stats/refresh/', null,  { params }),
  programSummary: params => api.get('/exam-stats/program_summary/',  { params }),
}
