import axios from 'axios'
import { isDemoSession } from './demoStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  if (isDemoSession()) return config
  const token = localStorage.getItem('cas_token')
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshRequest

api.interceptors.response.use(undefined, async (error) => {
  const originalRequest = error.config
  const refreshToken = localStorage.getItem('cas_refresh_token')

  if (
    error.response?.status !== 401 ||
    !originalRequest ||
    originalRequest._retry ||
    originalRequest._skipAuthRefresh ||
    originalRequest.url?.startsWith('/api/auth/') ||
    !refreshToken
  ) {
    return Promise.reject(error)
  }

  originalRequest._retry = true
  refreshRequest ??= axios
    .post(`${api.defaults.baseURL}/api/auth/refresh`, { refresh_token: refreshToken })
    .then(({ data }) => {
      localStorage.setItem('cas_token', data.access_token)
      if (data.refresh_token) localStorage.setItem('cas_refresh_token', data.refresh_token)
      return data.access_token
    })
    .catch((refreshError) => {
      localStorage.removeItem('cas_token')
      localStorage.removeItem('cas_refresh_token')
      localStorage.removeItem('cas_user')
      window.dispatchEvent(new Event('cas:session-expired'))
      throw refreshError
    })
    .finally(() => {
      refreshRequest = null
    })

  try {
    const token = await refreshRequest
    originalRequest.headers.Authorization = `Bearer ${token}`
    return api(originalRequest)
  } catch (refreshError) {
    return Promise.reject(refreshError)
  }
})

export default api
