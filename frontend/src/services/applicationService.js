import api from './api'
import { isDemoSession } from './demoStore'
import {
  attachDemoDocument,
  deleteDemoApplication,
  detachDemoDocument,
  downloadDemoApplicationPdf,
  getDemoApplicationDocuments,
  getDemoApplicationHistory,
  getDemoApplications,
  updateDemoApplicationStatus,
} from './demoService'

export const getApplications = () => isDemoSession() ? getDemoApplications() : api.get('/api/applications')
export const createApplication = (payload) => api.post('/api/applications', payload)
export const updateApplication = (id, payload) => isDemoSession()
  ? updateDemoApplicationStatus(id, payload.status)
  : api.patch(`/api/applications/${id}`, payload)
export const deleteApplication = (id) => isDemoSession() ? deleteDemoApplication(id) : api.delete(`/api/applications/${id}`)
export const confirmExternalSubmission = (id) => api.post(
  `/api/applications/${id}/confirm-submission`,
  { confirmed_external_submission: true },
)
export const downloadApplicationPdf = (id) => isDemoSession()
  ? downloadDemoApplicationPdf(id)
  : api.get(
  `/api/applications/${id}/pdf`,
  { responseType: 'blob' },
)
export const getApplicationHistory = (id) => isDemoSession()
  ? getDemoApplicationHistory(id).then(({ data }) => ({ data: data.map((item) => ({ ...item, summary: item.label })) }))
  : api.get(`/api/applications/${id}/history`)
export const getApplicationDocuments = (id) => isDemoSession()
  ? getDemoApplicationDocuments(id)
  : api.get(`/api/applications/${id}/documents`)
export const attachApplicationDocument = (applicationId, documentId) =>
  isDemoSession()
    ? attachDemoDocument(applicationId, documentId)
    : api.post(`/api/applications/${applicationId}/documents/${documentId}`)
export const detachApplicationDocument = (applicationId, documentId) =>
  isDemoSession()
    ? detachDemoDocument(applicationId, documentId)
    : api.delete(`/api/applications/${applicationId}/documents/${documentId}`)
