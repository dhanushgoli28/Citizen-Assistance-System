import api from './api'
import { isDemoSession } from './demoStore'
import { getDemoProfile, updateDemoProfile } from './demoService'
export const login = (payload) => api.post('/api/auth/login', payload)
export const register = (payload) => api.post('/api/auth/register', payload)
export const resendVerification = (payload) => api.post('/api/auth/resend-verification', payload)
export const verifyEmail = (payload) => api.post('/api/auth/verify', payload)
export const exchangeAuthCode = (payload) => api.post('/api/auth/exchange-code', payload)
export const updatePassword = (payload) => api.put('/api/auth/password', payload)
export const resetPassword = (payload) => api.post('/api/auth/password-reset', payload)
export const signOut = () => api.post('/api/auth/logout')
export const getCurrentUser = (accessToken) => api.get('/api/auth/me', accessToken
  ? {
      headers: { Authorization: `Bearer ${accessToken}` },
      _skipAuthRefresh: true,
    }
  : undefined)
export const getProfile = () => isDemoSession() ? getDemoProfile() : api.get('/api/users/profile')
export const updateProfile = (payload) => isDemoSession()
  ? updateDemoProfile(payload)
  : api.put('/api/users/profile', payload)
