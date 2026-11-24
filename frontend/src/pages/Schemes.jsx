import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ExternalLink, Search } from 'lucide-react'
import { checkSchemeEligibility, getSchemeAnswers, getSchemes } from '../services/schemeService'
import { isDemoSession } from '../services/demoStore'

export default function Schemes() {
  const [schemes, setSchemes] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [error, setError] = useState('')
  const [eligibility, setEligibility] = useState({})
  const [checking, setChecking] = useState('')
  const [answers, setAnswers] = useState({})

  useEffect(() => {
    let active = true
    getSchemes()
      .then(async ({ data }) => {
        if (!active) return
        setSchemes(data)
        if (isDemoSession()) {
          const entries = await Promise.all(data.map(async (scheme) => {
            const { data: savedAnswers } = await getSchemeAnswers(scheme.id)
            return [scheme.id, savedAnswers]
          }))
          if (active) setAnswers(Object.fromEntries(entries))
        }
      })
      .catch(() => { if (active) setError('Published scheme records could not be loaded.') })
    return () => { active = false }
  }, [])

  const categories = useMemo(
    () => ['All', ...new Set(schemes.map((scheme) => scheme.category))],
    [schemes],
  )
  const filtered = schemes.filter((scheme) => (
    (category === 'All' || scheme.category === category)
    && `${scheme.name} ${scheme.summary}`.toLowerCase().includes(query.toLowerCase())
  ))

  const checkEligibility = async (scheme) => {
    const schemeId = scheme.id
    setChecking(schemeId)
    setError('')
    try {
      const { data } = await checkSchemeEligibility(schemeId, answers[schemeId] || {})
      setEligibility((current) => ({ ...current, [schemeId]: data }))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Eligibility could not be evaluated.')
    } finally {
      setChecking('')
    }
  }

  return <>
    <header className="app-header"><div><span>{isDemoSession() ? 'ILLUSTRATIVE SCHEME DATA' : 'OFFICIAL SOURCES ONLY'}</span><h1>Scheme Finder</h1></div></header>
    <main className="dashboard-content">
      <div className="module-banner"><div><h2>Explore assistance schemes</h2><p>Eligibility checks are indicative, not government decisions. Always confirm current rules with the official programme.</p></div><span className="sample-label">{isDemoSession() ? 'Illustrative examples' : 'Source-verified records'}</span></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="filter-bar">
        <label className="search-field"><Search size={18}/><input aria-label="Search schemes" placeholder="Search published schemes…" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        <div className="filter-chips">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
      </div>
      {filtered.length === 0
        ? <section className="panel empty-state">{schemes.length ? 'No published schemes match your search.' : 'No verified schemes are currently published. Scheme records will appear after an administrator adds and verifies official source details.'}</section>
        : <div className="scheme-grid">{filtered.map((scheme) => {
          const result = eligibility[scheme.id]
          return <article className="scheme-card" key={scheme.id}>
            <div className="scheme-card-top"><div className="scheme-logo"><Building2 size={20}/></div><span className={scheme.jurisdiction === 'central' ? 'gov-pill' : 'private-pill'}>{scheme.jurisdiction === 'central' ? 'Central' : scheme.state}</span></div>
            <h3>{scheme.name}</h3>
            <p>{scheme.category}{scheme.state ? ` · ${scheme.state}` : ''}</p>
            <p>{scheme.summary}</p>
            {scheme.benefit && <p><strong>Potential benefit:</strong> {scheme.benefit}</p>}
            {scheme.required_documents?.length > 0 && <div className="scheme-documents"><strong>Commonly requested documents</strong><ul>{scheme.required_documents.map((document) => <li key={document}>{document}</li>)}</ul></div>}
            <p className="scheme-verified">{isDemoSession() ? 'Demo example; facts have not been independently verified for this release.' : `Verified: ${scheme.verified_at || 'not recorded'}`}</p>
            <a className="card-link" href={scheme.official_source_url} target="_blank" rel="noreferrer">Official source <ExternalLink size={15}/></a>
            {scheme.application_url && <a className="card-link" href={scheme.application_url} target="_blank" rel="noreferrer">Official application page <ExternalLink size={15}/></a>}
            {isDemoSession() && scheme.questions?.map((question) => <label className="scheme-question" key={question.id}>{question.label}<select value={(answers[scheme.id] || {})[question.id] || question.default || 'unsure'} onChange={(event) => setAnswers((current) => ({ ...current, [scheme.id]: { ...(current[scheme.id] || {}), [question.id]: event.target.value } }))}><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Not sure</option></select></label>)}
            <button className="btn btn-secondary eligibility-button" disabled={checking === scheme.id} onClick={() => checkEligibility(scheme)}>{checking === scheme.id ? 'Checking…' : 'Check my eligibility'}</button>
            {result && <div className="eligibility-result" aria-live="polite">
              <strong>{result.status.replaceAll('_', ' ')}</strong>
              <small>{result.disclaimer || 'Indicative only; not an approval or guarantee.'}</small>
              {result.rules.map((rule) => <p key={rule.criterion}><b>{rule.criterion}:</b> {rule.explanation} <small>({rule.status})</small></p>)}
              {result.missing_information.length > 0 && <p>Missing information: {result.missing_information.join(', ')}</p>}
            </div>}
            <Link className="card-link" to={`/forms?scheme_id=${scheme.id}`}>Prepare a draft</Link>
          </article>
        })}</div>}
    </main>
  </>
}
