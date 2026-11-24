import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { getNotifications, markNotificationRead } from '../services/notificationService'
import { isDemoSession } from '../services/demoStore'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getNotifications()
      .then(({ data }) => { if (active) setNotifications(data) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || 'Notifications could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const markRead = async (item) => {
    setBusy(item.id)
    setError('')
    try {
      const { data } = await markNotificationRead(item.id)
      setNotifications((current) => current.map((notification) => notification.id === item.id ? data : notification))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'The notification could not be marked as read.')
    } finally {
      setBusy('')
    }
  }

  return <>
    <header className="app-header"><div><span>YOUR UPDATES</span><h1>Notifications</h1></div></header>
    <main className="dashboard-content">
      {isDemoSession() && <div className="module-banner"><div><h2>Demonstration notifications</h2><p>Sample notifications are stored locally in this browser.</p></div><span className="sample-label">Demo data</span></div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <section className="panel notification-list" aria-busy={loading}>
        <div className="panel-head"><div><span>INBOX</span><h2>{notifications.filter((item) => !item.read_at).length} unread</h2></div></div>
        {loading ? <p className="empty-state" role="status">Loading notifications…</p>
          : notifications.length === 0 ? <p className="empty-state">You have no notifications.</p>
            : notifications.map((item) => <article className={`notification-card${item.read_at ? ' is-read' : ''}`} key={item.id}>
              <span className="notification-icon"><Bell size={18}/></span>
              <div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>
              {item.read_at ? <span className="read-label"><Check size={15}/> Read</span>
                : <button type="button" className="link-button" disabled={busy === item.id} onClick={() => markRead(item)}>{busy === item.id ? 'Saving…' : 'Mark read'}</button>}
            </article>)}
      </section>
    </main>
  </>
}
