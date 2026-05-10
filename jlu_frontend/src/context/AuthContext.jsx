import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { auth as authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    const access = localStorage.getItem('access')
    if (!access) { setLoading(false); return }

    // Read claims from stored user data
    const stored = localStorage.getItem('user')
    if (stored) {
      setUser(JSON.parse(stored))
      setLoading(false)
    } else {
      // Fetch from /users/me/ if we only have a token
      authApi.me()
        .then(r => { setUser(r.data); localStorage.setItem('user', JSON.stringify(r.data)) })
        .catch(() => { localStorage.clear() })
        .finally(() => setLoading(false))
    }
  }, [])

  const login = useCallback(async (jlu_id, password) => {
    const { data } = await authApi.login({ jlu_id, password })
    localStorage.setItem('access',  data.access)
    localStorage.setItem('refresh', data.refresh)
    const me = {
      jlu_id:               data.jlu_id,
      full_name:            data.full_name,
      role:                 data.role,
      profile_id:           data.profile_id,
      must_change_password: data.must_change_password ?? false,
    }
    localStorage.setItem('user', JSON.stringify(me))
    setUser(me)
    return me
  }, [])

  const clearMustChangePassword = useCallback(() => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, must_change_password: false }
      localStorage.setItem('user', JSON.stringify(updated))
      return updated
    })
  }, [])

  const logout = useCallback(() => {
    localStorage.clear()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
