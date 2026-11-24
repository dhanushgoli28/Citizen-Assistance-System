import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Download, FileText } from 'lucide-react'
import { downloadApplicationPdf } from '../services/applicationService'
import { getProfile } from '../services/authService'
import { generateForm, getFormTemplates, validateForm } from '../services/formService'
import { isDemoSession } from '../services/demoStore'
import { DEMO_FORM_FIELD_MAX_LENGTHS } from '../services/demoFixtures'

const fieldLabels = {
  full_name: 'Full name',
  phone: 'Phone number',
  address: 'Address',
  household_size: 'Household size',
  request_summary: 'What assistance are you seeking?',
  course_or_class: 'Course or class',
  institution: 'Institution',
  department: 'Department or service',
  reference_number: 'Reference number (if available)',
}

export default function SmartForms() {
  const [searchParams] = useSearchParams()
  const schemeId = searchParams.get('scheme_id')
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState('')
  const [data, setData] = useState({})
  const [validation, setValidation] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getFormTemplates(), getProfile()])
      .then(([templateResponse, profileResponse]) => {
        if (!active) return
        setTemplates(templateResponse.data)
        const firstTemplate = templateResponse.data[0]?.id || ''
        setTemplateId(firstTemplate)
        const profile = profileResponse.data || {}
        setData({
          full_name: profile.full_name || '',
          phone: profile.phone || '',
          address: profile.address || '',
        })
      })
      .catch(() => { if (active) setError('Form templates or your profile could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const template = templates.find((item) => item.id === templateId)
  const fields = useMemo(() => template?.required_fields || [], [template])

  const update = (key, value) => {
    setData((current) => ({ ...current, [key]: value }))
    setValidation(null)
    setDraft(null)
  }

  const checkRequired = async () => {
    setBusy(true)
    setError('')
    try {
      const { data: result } = await validateForm({ template_id: templateId, data })
      setValidation(result)
      return result.valid
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The form could not be validated.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = async (event) => {
    event.preventDefault()
    const valid = await checkRequired()
    if (!valid) return
    setBusy(true)
    setError('')
    try {
      const { data: result } = await generateForm({
        template_id: templateId,
        data,
        ...(schemeId ? { scheme_id: schemeId } : {}),
      })
      setDraft(result)
    } catch (requestError) {
      const detail = requestError.response?.data?.detail
      setError(typeof detail === 'string' ? detail : detail?.message || 'The draft could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const downloadDraft = async () => {
    if (!draft) return
    try {
      const { data: pdf } = await downloadApplicationPdf(draft.id)
      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = url
      link.download = 'citizenassist-application-draft.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Draft PDF export failed.')
    }
  }

  return <>
    <header className="app-header"><div><span>APPLICATION ASSISTANCE</span><h1>Smart Forms</h1></div></header>
    <main className="dashboard-content">
      <div className="module-banner"><div><h2>Prepare a reviewable draft</h2><p>These are generic assistance drafts, not official government forms. You remain responsible for submitting through the official channel.</p></div>{isDemoSession() && <span className="sample-label">Saved in this browser</span>}</div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading ? <div className="panel empty-state">Loading form templates…</div> : <div className="form-layout">
        <form className="panel form-panel" onSubmit={saveDraft}>
          <div className="panel-head"><div><span>PRIVATE DRAFT</span><h2>Application details</h2></div></div>
          <label>Draft type<select value={templateId} onChange={(event) => { setTemplateId(event.target.value); setValidation(null); setDraft(null) }}>{templates.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
          {fields.map((field) => <label key={field}>{fieldLabels[field] || field.replaceAll('_', ' ')} *{field === 'request_summary' ? <textarea required rows="4" maxLength={DEMO_FORM_FIELD_MAX_LENGTHS[field]} value={data[field] || ''} onChange={(event) => update(field, event.target.value)}/> : <input required type={field === 'household_size' ? 'number' : 'text'} min={field === 'household_size' ? 1 : undefined} maxLength={field === 'household_size' ? undefined : DEMO_FORM_FIELD_MAX_LENGTHS[field]} value={data[field] || ''} onChange={(event) => update(field, event.target.value)}/>}</label>)}
          <button type="button" className="btn btn-secondary" disabled={busy || !templateId} onClick={checkRequired}>Validate fields</button>
          <button className="btn btn-primary generate-button" disabled={busy || !templateId}>{busy ? 'Saving…' : 'Save application draft'}</button>
          {validation && <p className={validation.valid ? 'form-notice' : 'form-error'} role="status">{validation.message}{validation.missing_fields.length ? ` Missing: ${validation.missing_fields.join(', ')}.` : ''}</p>}
        </form>
        <aside className="panel preview">
          <div className="panel-head"><div><span>DRAFT PREVIEW</span><h2>{draft ? 'Saved draft' : 'Not saved yet'}</h2></div></div>
          {draft ? <div className="preview-content"><FileText size={28}/><strong>{draft.application_type}</strong><p>Status: {draft.status}</p><p>Draft ID: {draft.id}</p>{draft.is_demo && <p className="demo-disclaimer">Demo only. This draft was not submitted to a government department.</p>}<button type="button" onClick={downloadDraft}><Download size={16}/> Download PDF</button><Link className="card-link" to="/applications">View application history</Link></div> : <div className="empty-preview"><CheckCircle2 size={26}/><p>Validate and save to create a private draft.</p></div>}
        </aside>
      </div>}
    </main>
  </>
}
