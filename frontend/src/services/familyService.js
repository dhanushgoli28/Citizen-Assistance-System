import api from './api'
import { isDemoSession } from './demoStore'
import {
  addDemoFamilyMember,
  deleteDemoFamilyMember,
  getDemoFamily,
  updateDemoFamilyMember,
} from './demoService'

export const getFamilyMembers = () => isDemoSession() ? getDemoFamily() : api.get('/api/users/family')
export const addFamilyMember = (payload) => isDemoSession()
  ? addDemoFamilyMember(payload)
  : api.post('/api/users/family', payload)
export const updateFamilyMember = (id, payload) => isDemoSession()
  ? updateDemoFamilyMember(id, payload)
  : api.patch(`/api/users/family/${id}`, payload)
export const deleteFamilyMember = (id) => isDemoSession()
  ? deleteDemoFamilyMember(id)
  : api.delete(`/api/users/family/${id}`)
