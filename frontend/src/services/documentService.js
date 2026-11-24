import api from './api'
import { isDemoSession } from './demoStore'
import {
  analyzeDemoDocument,
  deleteDemoDocument,
  downloadDemoDocumentReport,
  getDemoDocumentExtraction,
  getDemoDocuments,
  uploadDemoDocument,
} from './demoService'

export const getDocuments = () => isDemoSession() ? getDemoDocuments() : api.get('/api/documents')
export const uploadDocument = (file) => {
  if (isDemoSession()) return uploadDemoDocument(file)
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/api/documents', formData, { headers: { 'Content-Type': undefined } })
}
export const analyzeDocument = (id) => isDemoSession() ? analyzeDemoDocument(id) : api.post(`/api/documents/${id}/analyze`)
export const getDocumentExtraction = (id) => isDemoSession()
  ? getDemoDocumentExtraction(id)
  : api.get(`/api/documents/${id}/extraction`)
export const downloadDocument = (id) =>
  isDemoSession() ? downloadDemoDocumentReport(id) : api.get(`/api/documents/${id}/download`, { responseType: 'blob' })
export const deleteDocument = (id) => isDemoSession() ? deleteDemoDocument(id) : api.delete(`/api/documents/${id}`)
