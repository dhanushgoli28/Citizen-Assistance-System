import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, Trash2 } from 'lucide-react'
import {
  attachApplicationDocument,
  confirmExternalSubmission,
  detachApplicationDocument,
  deleteApplication,
  downloadApplicationPdf,
  getApplicationDocuments,
  getApplicationHistory,
  getApplications,
  updateApplication,
} from '../services/applicationService'
import { getDocuments } from '../services/documentService'
import { isDemoSession } from '../services/demoStore'

export default function Applications() {
  const [applications, setApplications] = useState([])
  const [detail, setDetail] = useState(null)
  const [documentId, setDocumentId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    let active = true
    getApplications()
      .then(({ data }) => { if (active) setApplications(data) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || 'Applications could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const download = async (item) => {
    setBusy(item.id)
    setError('')
    try {
      const { data } = await downloadApplicationPdf(item.id)
      const url = URL.createObjectURL(data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${item.application_type.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The draft PDF could not be generated.')
    } finally {
      setBusy('')
    }
  }

  const toggleDetails = async (item) => {
    if (detail?.application.id === item.id) {
      setDetail(null)
      return
    }
    setBusy(item.id)
    setError('')
    try {
      const [documentResponse, associationResponse, historyResponse] = await Promise.all([
        getDocuments(),
        getApplicationDocuments(item.id),
        getApplicationHistory(item.id),
      ])
      setDetail({
        application: item,
        documents: documentResponse.data,
        attachedIds: associationResponse.data.map((association) => association.document_id),
        history: historyResponse.data,
      })
      setDocumentId('')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Application details could not be loaded.')
    } finally {
      setBusy('')
    }
  }

  const attachDocument = async () => {
    if (!detail || !documentId) return
    setBusy(detail.application.id)
    setError('')
    try {
      await attachApplicationDocument(detail.application.id, documentId)
      setDetail((current) => ({
        ...current,
        attachedIds: [...current.attachedIds, documentId],
      }))
      setDocumentId('')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The document could not be attached.')
    } finally {
      setBusy('')
    }
  }

  const detachDocument = async (id) => {
    if (!detail) return
    setBusy(detail.application.id)
    setError('')
    try {
      await detachApplicationDocument(detail.application.id, id)
      setDetail((current) => ({
        ...current,
        attachedIds: current.attachedIds.filter((attachedId) => attachedId !== id),
      }))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The document could not be detached.')
    } finally {
      setBusy('')
    }
  }

  const confirmSubmitted = async (item) => {
    if (!window.confirm('Only continue if you have already submitted this application outside CitizenAssist. This does not submit it for you.')) return
    setBusy(item.id)
    setError('')
    try {
      const { data } = await confirmExternalSubmission(item.id)
      setApplications((current) => current.map((app) => app.id === data.id ? data : app))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The application status could not be updated.')
    } finally {
      setBusy('')
    }
  }

  const removeDraft = async (item) => {
    if (!window.confirm('Delete this draft and its application-document associations?')) return
    setBusy(item.id)
    setError('')
    try {
      await deleteApplication(item.id)
      setApplications((current) => current.filter((app) => app.id !== item.id))
      if (detail?.application.id === item.id) setDetail(null)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The draft could not be deleted.')
    } finally {
      setBusy('')
    }
  }

  const updateDemoStatus = async (item, status) => {
    setBusy(item.id)
    setError('')
    try {
      const { data } = await updateApplication(item.id, { status })
      setApplications((current) => current.map((app) => app.id === item.id ? data : app))
      if (detail?.application.id === item.id) setDetail(null)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The sample status could not be updated.')
    } finally {
      setBusy('')
    }
  }

  return <>
    <header className="app-header"><div><span>YOUR RECORDS</span><h1>Applications</h1></div></header>
    <main className="dashboard-content">
      <div className="module-banner"><div><h2>Application drafts and tracking</h2><p>{isDemoSession() ? 'All statuses shown here are simulated examples; no government case or submission is connected.' : 'CitizenAssist does not submit forms to government portals.'}</p></div><Link className="btn btn-primary" to="/forms">Create draft</Link></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading ? <div className="panel empty-state">Loading your applications…</div>
        : applications.length === 0 ? <div className="panel empty-state">No applications have been saved yet.</div>
          : <div className="panel application-list">{applications.map((item) => <article className="application-row" key={item.id}>
            <div className="file-icon"><FileText/></div>
            <div className="application-summary"><strong>{item.application_type}</strong><small>{isDemoSession() ? `Sample status: ${item.status.replaceAll('_', ' ')}` : item.status} · Updated {new Date(item.updated_at).toLocaleDateString()}</small></div>
            {isDemoSession() && <label className="demo-status-control">Demo status<select aria-label={`Set sample status for ${item.application_type}`} value={item.status} disabled={busy === item.id} onChange={(event) => updateDemoStatus(item, event.target.value)}><option value="draft">Draft</option><option value="under_review">Sample under review</option><option value="documents_required">Sample documents required</option><option value="completed">Sample completed</option></select></label>}
            <button type="button" className="icon-button" title="Download draft PDF" disabled={busy === item.id} onClick={() => download(item)}><Download size={16}/></button>
            <button type="button" className="link-button" disabled={Boolean(busy)} onClick={() => toggleDetails(item)}>Documents & history</button>
            {!isDemoSession() && item.status === 'draft' && <button type="button" className="link-button" onClick={() => confirmSubmitted(item)} disabled={busy === item.id}>I submitted externally</button>}
            {item.status === 'draft' && <button type="button" className="icon-button" title="Delete draft" disabled={busy === item.id} onClick={() => removeDraft(item)}><Trash2 size={16}/></button>}
            {detail?.application.id === item.id && <div className="application-details">
              <h3>Associated private documents</h3>
              {detail.attachedIds.length
                ? detail.attachedIds.map((id) => {
                  const file = detail.documents.find((document) => document.id === id)
                  return <div className="family-row" key={id}><span>{file?.original_filename || 'Private document'}</span><button type="button" className="link-button" disabled={Boolean(busy)} onClick={() => detachDocument(id)}>Remove</button></div>
                })
                : <p className="empty-state">No documents are associated with this application.</p>}
              <div className="association-controls">
                <select aria-label="Select a private document" value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
                  <option value="">Select one of your documents</option>
                  {detail.documents.filter((file) => !detail.attachedIds.includes(file.id)).map((file) => <option key={file.id} value={file.id}>{file.original_filename}</option>)}
                </select>
                <button type="button" className="btn btn-secondary" disabled={!documentId || Boolean(busy)} onClick={attachDocument}>Attach document</button>
              </div>
              <h3>Status and activity history</h3>
              {detail.history.length
                ? detail.history.map((event) => <p className="history-event" key={event.id}><strong>{event.summary}</strong><small>{new Date(event.created_at).toLocaleString()}</small></p>)
                : <p className="empty-state">No status changes or activity have been recorded.</p>}
            </div>}
          </article>)}</div>}
    </main>
  </>
}
