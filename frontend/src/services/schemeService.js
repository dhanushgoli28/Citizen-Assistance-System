import api from './api'
import { isDemoSession } from './demoStore'
import {
  checkDemoSchemeEligibility,
  getDemoSchemeAnswers,
  getDemoSchemes,
} from './demoService'

export const getSchemes = (params) => isDemoSession() ? getDemoSchemes(params) : api.get('/api/schemes', { params })
export const getSchemeAnswers = (schemeId) => isDemoSession()
  ? getDemoSchemeAnswers(schemeId)
  : Promise.resolve({ data: {} })
export const recommendSchemes = (payload) => api.post('/api/schemes/recommend', payload)
export const checkSchemeEligibility = (schemeId, answers) => isDemoSession()
  ? checkDemoSchemeEligibility(schemeId, answers)
  : api.post(`/api/schemes/${schemeId}/eligibility`)
