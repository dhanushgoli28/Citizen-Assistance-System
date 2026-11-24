import api from './api'
import { isDemoSession } from './demoStore'
import { generateDemoForm, getDemoFormTemplates, validateDemoForm } from './demoService'

export const generateForm = (payload) => isDemoSession()
  ? generateDemoForm(payload)
  : api.post('/api/forms/generate', payload)
export const validateForm = (payload) => isDemoSession()
  ? Promise.resolve({ data: validateDemoForm(payload) })
  : api.post('/api/forms/validate', payload)
export const getFormTemplates = () => isDemoSession() ? getDemoFormTemplates() : api.get('/api/forms/templates')
