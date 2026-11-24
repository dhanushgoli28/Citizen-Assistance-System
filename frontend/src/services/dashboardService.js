import api from './api'
import { isDemoSession } from './demoStore'
import { getDemoDashboard } from './demoService'

export const getDashboard = () => isDemoSession() ? getDemoDashboard() : api.get('/api/dashboard')
