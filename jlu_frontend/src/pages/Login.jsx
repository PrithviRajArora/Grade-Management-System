import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { auth as authApi } from '../api'

/* ── SVG Icon Components ─────────────────────────────────── */

const Icons = {
  lock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  bookOpen: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  graduationCap: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
    </svg>
  ),
  barChart: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  target: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  lockSecure: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  externalLink: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  keyRound: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  ),
}

function ForceChangePasswordModal({ onDone }) {
  const [form, setForm] = useState({ old_password: 'Password', new_password: '', confirm: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.new_password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.new_password === 'Password') { setError('Please choose a different password than the default.'); return }
    if (form.new_password !== form.confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    try {
      await authApi.changePassword({ old_password: form.old_password, new_password: form.new_password })
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password.')
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: '32px 36px',
        width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            <span style={{ color: 'var(--accent)', display: 'flex' }}>{Icons.keyRound}</span>
            Change Your Password
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>
            You are using the default password <strong>"Password"</strong>. For security purposes, you must set a new password before continuing.
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">New Password *</label>
            <input
              className="form-input" type="password" autoFocus required
              placeholder="Min 8 characters"
              value={form.new_password}
              onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password *</label>
            <input
              className="form-input" type="password" required
              placeholder="Repeat your new password"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            />
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 14, padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={saving || !form.new_password || !form.confirm}
          >
            {saving
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Updating...</>
              : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Login() {
  const { login, clearMustChangePassword } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ jlu_id: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForceChange, setShowForceChange] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const me = await login(form.jlu_id.trim(), form.password)
      if (me.must_change_password) {
        setShowForceChange(true)
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function fill(jlu_id, password) {
    setForm({ jlu_id, password })
  }

  function handlePasswordChanged() {
    clearMustChangePassword()
    setShowForceChange(false)
    navigate('/')
  }

  return (
    <div className="login-page">
      {showForceChange && <ForceChangePasswordModal onDone={handlePasswordChanged} />}

      {/* ── Left Panel: Form ── */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
            </svg>
          </div>
          <div className="login-brand-text">
            Marksheet
            <span>Jagran Lakecity University</span>
          </div>
        </div>

        <h1 className="login-heading">Welcome Back</h1>
        <p className="login-subheading">Sign in with your university credentials to continue</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-form-group">
            <label>JLU ID or Username</label>
            <div className="login-input-wrap">
              <span className="input-icon">{Icons.user}</span>
              <input
                type="text"
                placeholder="e.g. FAC001 or STU001"
                value={form.jlu_id}
                onChange={e => setForm(f => ({ ...f, jlu_id: e.target.value }))}
                autoFocus
                required
              />
            </div>
          </div>

          <div className="login-form-group">
            <label>Password</label>
            <div className="login-input-wrap">
              <span className="input-icon">{Icons.lock}</span>
              <input
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="login-extras">
            <label>
              <input type="checkbox" /> Remember me
            </label>
            <a href="#">Forgot password?</a>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Signing in...</>
              : 'Sign In'}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="login-demo">
          <div className="login-demo-title">Quick Access — Demo Accounts</div>
          <div className="login-demo-grid">
            {[
              ['ADM001', 'Admin@1234', 'Admin', Icons.shield],
              ['FAC001', 'Faculty@1234', 'Faculty', Icons.bookOpen],
              ['STU001', 'Student@1234', 'Student', Icons.graduationCap],
            ].map(([id, pw, role, icon]) => (
              <button
                key={id}
                className="login-demo-btn"
                type="button"
                onClick={() => fill(id, pw)}
              >
                <span className="demo-icon">{icon}</span>
                <span className="demo-role">{role}</span>
                <span className="demo-id">{id}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Showcase ── */}
      <div className="login-right">
        <div className="login-right-content">
          <div className="login-right-badge">
            <span className="badge-dot" />
            Academic Portal
          </div>

          <h2 className="login-showcase-title">
            Your Complete Academic<br />Management System
          </h2>
          <p className="login-showcase-subtitle">
            A centralized platform for managing grades, courses,
            and academic records at Jagran Lakecity University.
          </p>

          <ul className="login-features">
            <li>
              <span className="feat-icon">{Icons.barChart}</span>
              Track courses, assignments and grades
            </li>
            <li>
              <span className="feat-icon">{Icons.users}</span>
              Faculty management, student tracking and timetables
            </li>
            <li>
              <span className="feat-icon">{Icons.target}</span>
              Student-driven approach for the entire university
            </li>
            <li>
              <span className="feat-icon">{Icons.lockSecure}</span>
              Role-based access control and secure authentication
            </li>
          </ul>

          <div className="login-cta-row">
            <a href="https://www.jlu.edu.in" target="_blank" rel="noopener noreferrer" className="login-cta login-cta-primary">
              University Website {Icons.externalLink}
            </a>
            <a href="https://www.jlu.edu.in/virtual-tour" target="_blank" rel="noopener noreferrer" className="login-cta login-cta-secondary">
              Virtual Campus Tour {Icons.externalLink}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
