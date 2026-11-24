import { useEffect, useState } from 'react'
import { ExternalLink, Scale, Send, Sparkles } from 'lucide-react'
import {
  getLegalConversations,
  getLegalMessages,
  sendLegalQuestion,
} from '../services/legalService'
import { isDemoSession } from '../services/demoStore'

const categories = [
  ['general', 'General information'],
  ['rights_welfare', 'Rights & welfare'],
  ['consumer', 'Consumer matters'],
  ['employment', 'Employment'],
  ['rti', 'RTI & governance'],
  ['property', 'Property'],
  ['civil', 'Civil procedure'],
]

const suggestions = [
  'What can I do if a public-service application is rejected?',
  'Where can I find official consumer complaint guidance?',
  'Where can I submit an RTI request?',
]

const welcomeMessage = {
  role: 'assistant',
  text: 'Ask a general question about Indian legal processes. I will provide general information only and link official sources when they are available.',
  sources: [],
}

export default function LegalAssistant() {
  const [messages, setMessages] = useState([welcomeMessage])
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState('')
  const [text, setText] = useState('')
  const [category, setCategory] = useState('general')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getLegalConversations()
      .then(({ data }) => { if (active) setConversations(data) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || 'Conversation history could not be loaded.')
      })
    return () => { active = false }
  }, [])

  const selectConversation = async (id) => {
    if (!id) {
      setConversationId('')
      setMessages([welcomeMessage])
      setError('')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { data } = await getLegalMessages(id)
      setConversationId(id)
      setCategory(conversations.find((item) => item.id === id)?.category || 'general')
      setMessages([
        welcomeMessage,
        ...data.map((item) => ({
          role: item.role,
          text: item.content,
          sources: item.source_references || [],
          grounded: item.role === 'assistant' && (item.source_references || []).length > 0,
        })),
      ])
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Conversation history could not be loaded.')
    } finally {
      setBusy(false)
    }
  }

  const send = async (value = text) => {
    const message = value.trim()
    if (!message || busy) return

    setMessages((current) => [...current, { role: 'user', text: message }])
    setText('')
    setError('')
    setBusy(true)

    try {
      const { data } = await sendLegalQuestion({
        message,
        category,
        conversation_id: conversationId || undefined,
      })
      setConversationId(data.conversation_id)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: data.answer,
          sources: data.sources,
          grounded: data.grounded,
        },
      ])
      try {
        const { data: updatedConversations } = await getLegalConversations()
        setConversations(updatedConversations)
      } catch {
        setError('Your answer was saved, but the conversation list could not be refreshed.')
      }
    } catch (requestError) {
      const detail = requestError.response?.data?.detail
      setError(typeof detail === 'string'
        ? detail
        : 'The legal assistant is unavailable. Please try again later.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="app-header">
        <div><span>{isDemoSession() ? 'SCRIPTED DEMONSTRATION' : 'GENERAL GUIDANCE'}</span><h1>AI Legal Assistant</h1></div>
      </header>
      <main className="dashboard-content">
        {isDemoSession() && <div className="module-banner"><div><h2>Legal assistant demo</h2><p>Replies are scripted examples, not Gemini output or legal advice. Verify information using the linked official sources.</p></div><span className="sample-label">Not AI-generated</span></div>}
        <div className="legal-layout">
          <aside className="panel categories">
            <h3>Legal topics</h3>
            {categories.map(([value, label]) => (
              <button
                key={value}
                className={category === value ? 'active' : ''}
                onClick={() => setCategory(value)}
                disabled={busy}
              >
                <Scale size={16} />{label}
              </button>
            ))}
            <label className="conversation-picker">Saved conversations
              <select value={conversationId} onChange={(event) => selectConversation(event.target.value)} disabled={busy}>
                <option value="">Start a new conversation</option>
                {conversations.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          </aside>
          <section className="chat-panel">
            <div className="chat-head">
              <div className="bot-avatar"><Sparkles size={19} /></div>
              <div><strong>CAS Legal Assistant</strong><small>General information · Not legal advice</small></div>
            </div>
            <div className="chat-messages" aria-live="polite">
              {messages.map((item, index) => (
                <div key={`${index}-${item.role}`} className={`message ${item.role}`}>
                  {item.text}
                  {item.role === 'assistant' && item.grounded && (
                    <small className="grounded-label">Grounded in official sources</small>
                  )}
                  {item.sources?.length > 0 && (
                    <div className="legal-sources">
                      {item.sources.map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                          <ExternalLink size={13} />{source.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && <div className="message assistant" role="status">{isDemoSession() ? 'Preparing a scripted demo response…' : 'Checking official sources…'}</div>}
            </div>
            {error && <div className="form-error legal-error" role="alert">{error}</div>}
            <div className="suggestions">
              {suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => send(suggestion)} disabled={busy}>
                  {suggestion}
                </button>
              ))}
            </div>
            <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send() }}>
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Ask a general legal question…"
                maxLength={2000}
                disabled={busy}
                aria-label="Legal question"
              />
              <button type="submit" aria-label="Send" disabled={busy || !text.trim()}>
                <Send size={18} />
              </button>
            </form>
            <div className="disclaimer">
              General legal information only—not legal advice. Verify current requirements with official sources or a qualified legal professional.
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
