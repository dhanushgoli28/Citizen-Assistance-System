import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Eye, FileText, Trash2, UploadCloud } from 'lucide-react'
import {
  analyzeDocument,
  deleteDocument,
  downloadDocument,
  getDocumentExtraction,
  getDocuments,
  uploadDocument,
} from '../services/documentService'
import { isDemoSession } from '../services/demoStore'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export default function Documents() {
  const input = useRef(null)
  const [documents, setDocuments] = useState([])
  const [selected, setSelected] = useState(null)
  const [extraction, setExtraction] = useState(null)
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getDocuments()
      .then(({ data }) => { if (active) setDocuments(data) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || 'Your documents could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const addFiles = async (fileList) => {
    for (const file of Array.from(fileList)) {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > MAX_FILE_SIZE) {
        setError(`${file.name}: select a PDF, JPG, or PNG no larger than 10 MiB.`)
        continue
      }
      setBusy(file.name)
      setError('')
      try {
        const { data } = await uploadDocument(file)
        setDocuments((current) => [data, ...current])
      } catch (requestError) {
        setError(requestError.response?.data?.detail || `${file.name} could not be uploaded.`)
      } finally {
        setBusy('')
      }
    }
    if (input.current) input.current.value = ''
  }

  const analyze = async (document) => {
    setBusy(document.id)
    setError('')
    setSelected(document)
    setExtraction(null)
    try {
      const { data } = await analyzeDocument(document.id)
      setExtraction(data)
      const updatedDocument = { ...document, status: 'processed', document_type: data.document_type }
      setSelected(updatedDocument)
      setDocuments((current) => current.map((item) => item.id === document.id ? updatedDocument : item))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Document processing failed.')
      setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, status: 'failed' } : item))
    } finally {
      setBusy('')
    }
  }

  const viewExtraction = async (document) => {
    setSelected(document)
    setError('')
    try {
      const { data } = await getDocumentExtraction(document.id)
      setExtraction(data)
    } catch (requestError) {
      setExtraction(null)
      if (requestError.response?.status !== 404) {
        setError(requestError.response?.data?.detail || 'The extraction could not be loaded.')
      }
    }
  }

  const download = async (document) => {
    setBusy(document.id)
    setError('')
    try {
      const { data } = await downloadDocument(document.id)
      const url = window.URL.createObjectURL(data)
      const link = window.document.createElement('a')
      link.href = url
      const baseName = document.original_filename.replace(/\.[^.]+$/, '')
      link.download = isDemoSession() ? `${baseName}-demo-report.pdf` : document.original_filename
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The document could not be downloaded.')
    } finally {
      setBusy('')
    }
  }

  const remove = async (document) => {
    if (!window.confirm(`Permanently delete ${document.original_filename}?`)) return
    setBusy(document.id)
    setError('')
    try {
      await deleteDocument(document.id)
      setDocuments((current) => current.filter((item) => item.id !== document.id))
      if (selected?.id === document.id) {
        setSelected(null)
        setExtraction(null)
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The document could not be deleted.')
    } finally {
      setBusy('')
    }
  }

  return <>
    <header className="app-header"><div><span>{isDemoSession() ? 'LOCAL DEMONSTRATION WORKSPACE' : 'PRIVATE DOCUMENT STORAGE'}</span><h1>My Documents</h1></div></header>
    <main className="dashboard-content">
      {error && <div className="form-error" role="alert">{error}</div>}
      {isDemoSession() && <div className="module-banner"><div><h2>Document Intelligence demo</h2><p>Selected files are checked locally for file type only; file contents are not uploaded or OCR-processed. Analysis results are scripted examples.</p></div><span className="sample-label">No server upload</span></div>}
      <div className="document-layout">
        <section>
          <div
            className="upload-box"
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') input.current?.click() }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files) }}
          >
            <input ref={input} hidden type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => addFiles(event.target.files)} />
            <div className="upload-icon"><UploadCloud/></div>
            <h3>{busy && !documents.some((item) => item.id === busy) ? 'Uploading…' : 'Drop documents here'}</h3>
            <p>or <strong>browse files</strong></p><small>PDF, JPG or PNG · Maximum 10 MiB each{isDemoSession() ? ' · checked locally' : ''}</small>
          </div>
          <div className="panel document-list">
            <div className="panel-head"><div><span>YOUR UPLOADS</span><h2>Document library</h2></div></div>
            {loading ? <p className="empty-state">Loading your documents…</p>
              : documents.length === 0 ? <p className="empty-state">No documents uploaded.</p>
                : documents.map((document) => <div className="document-row" key={document.id}>
                  <div className="file-icon"><FileText/></div>
                  <div><strong>{document.original_filename}</strong><small>{(document.file_size_bytes / 1048576).toFixed(2)} MiB · {document.document_type || 'Unclassified'}</small></div>
                  <span className={document.status === 'processed' ? 'status-ok' : 'status-pending'}>{document.status === 'processed' ? <CheckCircle2/> : <AlertCircle/>}{document.status}</span>
                  {document.status === 'uploaded' || document.status === 'failed'
                    ? <button type="button" title="Analyze document" disabled={Boolean(busy)} onClick={() => analyze(document)}><Eye size={16}/></button>
                    : <button type="button" title="View extraction" onClick={() => viewExtraction(document)}><Eye size={16}/></button>}
                  <button type="button" title={isDemoSession() ? 'Download demo analysis report' : 'Download private document'} disabled={Boolean(busy)} onClick={() => download(document)}><Download size={16}/></button>
                  <button type="button" title="Delete document" disabled={Boolean(busy)} onClick={() => remove(document)}><Trash2 size={16}/></button>
                </div>)}
          </div>
        </section>
        <aside className="panel extracted-panel">
          <div className="panel-head"><div><span>EXTRACTED INFORMATION</span><h2>{selected?.original_filename || 'No document selected'}</h2></div></div>
          {!extraction ? <p className="empty-state">{isDemoSession() ? 'Analyze a sample document to see clearly labelled scripted results. Files selected in demo mode are not uploaded or stored.' : 'Analyze an uploaded document to see text-extraction results. Original files remain private; extracted raw text is not stored.'}</p>
            : <>
              <div className="info-row"><span>Processing</span><strong>{extraction.processing_method}</strong></div>
              <div className="info-row"><span>Document type</span><strong>{selected?.document_type || 'Unclassified'}</strong></div>
              <div className="explanation"><h3>Processing summary</h3><p>{extraction.summary}</p></div>
              {extraction.missing_information?.map((item) => <div className="missing" key={item}><AlertCircle size={17}/><div><strong>Review required</strong><small>{item}</small></div></div>)}
              {extraction.extracted_text && <details className="extracted-text"><summary>View extracted text</summary><pre>{extraction.extracted_text}</pre></details>}
              <p className="disclaimer">{extraction.demo_simulated ? 'This is scripted sample output, not OCR. The uploaded file contents were not read or stored.' : 'Classification and missing-information checks are automated hints, not verification of the document.'}</p>
            </>}
        </aside>
      </div>
    </main>
  </>
}
