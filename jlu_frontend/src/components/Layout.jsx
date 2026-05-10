import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = {
  admin: [
    { to: '/',          icon: '⬡', label: 'Dashboard' },
    { to: '/courses',   icon: '◈', label: 'Courses' },
    { to: '/students',  icon: '◉', label: 'Students' },
    { to: '/backlogs',  icon: '⚑', label: 'Backlogs' },
    { to: '/analytics', icon: '◎', label: 'Analytics' },
    { to: '/admin',     icon: '✠', label: 'Authoritative Panel' },
    { to: '/profile',   icon: '◉', label: 'Profile' },
  ],
  faculty: [
    { to: '/',              icon: '⬡', label: 'Dashboard' },
    { to: '/courses',       icon: '◈', label: 'My Courses' },
    { to: '/backlogs',      icon: '⚑', label: 'Backlogs' },
    { to: '/analytics',     icon: '◎', label: 'Analytics' },
    { to: '/profile',       icon: '◉', label: 'Profile' },
  ],
  student: [
    { to: '/',           icon: '⬡', label: 'Dashboard' },
    { to: '/my-results', icon: '◈', label: 'My Results' },
    { to: '/my-backlogs',icon: '⚑', label: 'My Backlogs' },
    { to: '/profile',    icon: '◉', label: 'Profile' },
  ],
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const navItems         = NAV[user?.role] ?? []

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="wordmark">Marksheet</div>
          <div className="subtitle">Academic Management System</div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials(user?.full_name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name}
              </div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              title="Logout"
              style={{ padding: '4px 8px', minWidth: 'auto' }}
            >
              ⇥
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="main-area">
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  )
}
