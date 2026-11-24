import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser, signOut } from '../services/authService'
import { DEMO_MODE_ENABLED, DEMO_USER } from '../services/demoConfig'
import {
  enterDemoSession,
  isDemoSession,
  leaveDemoSession,
  resetDemoData,
} from '../services/demoStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => isDemoSession() ? DEMO_USER : null)
  const [loading, setLoading] = useState(() => !isDemoSession() && Boolean(localStorage.getItem('cas_token')))

  useEffect(() => {
    let active = true
    if (isDemoSession()) return undefined

    const clearSession = () => {
      localStorage.removeItem('cas_user')
      localStorage.removeItem('cas_token')
      localStorage.removeItem('cas_refresh_token')
      if (active) setUser(null)
    }

    const token = localStorage.getItem('cas_token')
    if (token) {
      getCurrentUser()
        .then(({ data }) => {
          if (active) setUser({
            id: data.id,
            email: data.email,
            name: data.user_metadata?.full_name || data.email,
          })
        })
        .catch(clearSession)
        .finally(() => {
          if (active) setLoading(false)
        })
    }

    window.addEventListener('cas:session-expired', clearSession)
    return () => {
      active = false
      window.removeEventListener('cas:session-expired', clearSession)
    }
  }, [])

  const loginUser = (session) => {
    leaveDemoSession()
    const nextUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.email,
    }
    localStorage.setItem('cas_user', JSON.stringify(nextUser))
    localStorage.setItem('cas_token', session.access_token)
    if (session.refresh_token) localStorage.setItem('cas_refresh_token', session.refresh_token)
    setUser(nextUser)
  }

  const logout = async () => {
    if (isDemoSession()) {
      leaveDemoSession()
      localStorage.removeItem('cas_user')
      localStorage.removeItem('cas_token')
      localStorage.removeItem('cas_refresh_token')
      setUser(null)
      return null
    }

    let error = null
    try {
      if (localStorage.getItem('cas_token')) await signOut()
    } catch (signOutError) {
      error = signOutError
    } finally {
      localStorage.removeItem('cas_user')
      localStorage.removeItem('cas_token')
      localStorage.removeItem('cas_refresh_token')
      setUser(null)
    }
    return error
  }

  const enterDemo = () => {
    if (!DEMO_MODE_ENABLED || !enterDemoSession()) return false
    localStorage.removeItem('cas_user')
    localStorage.removeItem('cas_token')
    localStorage.removeItem('cas_refresh_token')
    setUser(DEMO_USER)
    return true
  }

  const resetDemo = () => resetDemoData()

  return <AuthContext.Provider value={{ user, loading, loginUser, logout, enterDemo, resetDemo }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
