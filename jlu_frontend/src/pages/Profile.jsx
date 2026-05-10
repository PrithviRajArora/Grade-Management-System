import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import api from '../api'

export default function Profile() {
  const { user, logout }   = useAuth()
  const toast              = useToast()
  const [form, setForm]    = useState({ old_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  async function handleChangePassword(e) {
    e.preventDefault()
    if (form.new_password !== form.confirm) {
      toast.error('New passwords do not match.')
      return
    }
    if (form.new_password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      await api.post('/users/change_password/', {
        old_password: form.old_password,
        new_password: form.new_password,
      })
      toast.success('✓ Password changed. Please log in again.')
      setForm({ old_password: '', new_password: '', confirm: '' })
      setTimeout(logout, 2000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">My Profile</div>
        <div className="page-desc">Account information and security settings</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 860 }}>

        {/* Info card */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>Account Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['JLU ID',      user?.jlu_id,      'var(--accent)'],
              ['Full Name',   user?.full_name,   ''],
              ['Role',        user?.role,         ''],
              ['Profile ID',  user?.profile_id || '—', 'var(--text2)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {label}
                </span>
                <span style={{ fontWeight: 600, color: color || 'var(--text)', fontFamily: label === 'JLU ID' || label === 'Profile ID' ? 'var(--mono)' : undefined }}>
                  {val}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: 16, background: 'var(--surface2)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Role Permissions</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {user?.role === 'admin'   && 'Full system access — manage users, courses, and all data.'}
              {user?.role === 'faculty' && 'Enter marks for assigned courses, view analytics, manage enrolments.'}
              {user?.role === 'student' && 'View your results and academic report.'}
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>Change Password</div>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-input" placeholder="••••••••"
                value={form.old_password}
                onChange={e => setForm(f => ({ ...f, old_password: e.target.value }))}
                required />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-input" placeholder="Min. 8 characters"
                value={form.new_password}
                onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                required minLength={8} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input type="password" className="form-input" placeholder="Repeat new password"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                required />
              {form.confirm && form.new_password !== form.confirm && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 5 }}>Passwords do not match.</div>
              )}
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
              disabled={saving || (form.confirm && form.new_password !== form.confirm)}>
              {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : 'Update Password'}
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { if (window.confirm('Log out of this session?')) logout() }}>
              Sign Out
            </button>
          </div>
        </div>

      </div>
    </>
  )
}
