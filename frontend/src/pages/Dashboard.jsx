import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import { Search, FolderUp, FileText, ArrowRight, Bell, Users, RotateCcw, LogOut, Scale, ClipboardList } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getDashboard } from '../services/dashboardService'
import { markNotificationRead } from '../services/notificationService'

export function AppShell() {
  const { user, resetDemo, logout } = useAuth()
  const navigate = useNavigate()
  const handleReset = () => {
    try {
      resetDemo()
      window.location.reload()
    } catch (error) {
      window.alert(error.message)
    }
  }
  const exitDemo = async () => {
    await logout()
    navigate('/')
  }
  return <div className="app-shell"><Sidebar/><div className="app-main">
    {user?.isDemo && <div className="demo-ribbon" role="status"><span><strong>DEMO WORKSPACE</strong> Fictional sample data; changes are saved in this browser only.</span><div><button type="button" onClick={handleReset}><RotateCcw size={15}/> Reset demo</button><button type="button" onClick={exitDemo}><LogOut size={15}/> Exit demo</button></div></div>}
    <Outlet/>
  </div></div>
}

export function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getDashboard()
      .then(({ data: result }) => { if (active) setData(result) })
      .catch(() => { if (active) setError('Dashboard data could not be loaded. Please try again.') })
    return () => { active = false }
  }, [])

  const applications = data?.applications || []
  const documents = data?.documents || []
  const unread = data?.notifications?.filter((item) => !item.read_at) || []

  const markRead = async (id) => {
    try {
      const { data: updated } = await markNotificationRead(id)
      setData((current) => ({
        ...current,
        notifications: current.notifications.map((item) => item.id === id ? updated : item),
      }))
    } catch {
      setError('The notification could not be marked as read.')
    }
  }

  return <>
    <header className="app-header">
      <div><span>CITIZEN DASHBOARD</span><h1>Welcome, {data?.profile?.full_name || user?.name || 'Citizen'}</h1></div>
      <div className="header-actions"><Link to="/profile" aria-label="Profile"><Users size={19}/></Link><div className="avatar">{(user?.name || 'C').slice(0, 1)}</div></div>
    </header>
    <main className="dashboard-content">
      {error && <div className="form-error" role="alert">{error}</div>}
      {!data && !error && <div className="panel empty-state" role="status">Loading your records…</div>}
      <section className="welcome-banner">
        <div><span className="demo-badge">{user?.isDemo ? 'DEMO WORKSPACE' : 'PERSONAL WORKSPACE'}</span><h2>Your public-service workspace</h2><p>{user?.isDemo ? 'Explore simulated examples. Nothing here is an official application or government status.' : 'Review your saved records and continue a draft when you are ready.'}</p></div>
        <Link className="btn btn-secondary" to="/profile">Update profile <ArrowRight size={16}/></Link>
      </section>
      <section className="stats-grid">
        <StatCard icon={Search} label={user?.isDemo ? 'Scheme examples' : 'Featured schemes'} value={data?.schemes?.length ?? '—'} tone="blue" detail={user?.isDemo ? 'Illustrative entries' : 'Published records'}/>
        <StatCard icon={FolderUp} label={user?.isDemo ? 'Sample documents' : 'Recent documents'} value={data?.counts?.documents ?? '—'} tone="teal" detail={user?.isDemo ? 'Includes fictional examples' : 'Latest private uploads'}/>
        <StatCard icon={FileText} label={user?.isDemo ? 'Demo applications' : 'Recent applications'} value={data?.counts?.applications ?? '—'} tone="amber" detail={user?.isDemo ? 'No government submissions' : 'Latest tracked records'}/>
        <StatCard icon={Bell} label="Unread notifications" value={data?.counts?.unread_notifications ?? '—'} tone="red" detail="View your notifications"/>
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head"><div><span>{user?.isDemo ? 'ILLUSTRATIVE ENTRIES' : 'VERIFIED RECORDS'}</span><h2>{user?.isDemo ? 'Scheme examples' : 'Published schemes'}</h2></div><Link to="/schemes">View all</Link></div>
          {data?.schemes?.length
            ? data.schemes.map((scheme) => <div className="scheme-row" key={scheme.id}><div className="scheme-logo"><Search size={18}/></div><div><strong>{scheme.name}</strong><small>{scheme.category} · {user?.isDemo ? 'Demo entry; verify current details' : `Verified ${scheme.verified_at}`}</small></div><a href={scheme.official_source_url} target="_blank" rel="noreferrer">Source</a></div>)
            : data && <p className="empty-state">No verified schemes are currently published.</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><div><span>RECENT RECORDS</span><h2>Applications & documents</h2></div><Link to="/applications">Applications</Link></div>
          <div className="activity-list">
            {applications.slice(0, 3).map((item) => <div key={item.id}><i className="dot blue"/><div><strong>{item.application_type}</strong><small>{item.status} · {new Date(item.updated_at).toLocaleDateString()}</small></div></div>)}
            {documents.slice(0, 2).map((item) => <div key={item.id}><i className="dot green"/><div><strong>{item.original_filename}</strong><small>{item.document_type || 'Unclassified'} · {item.status}</small></div></div>)}
            {!applications.length && !documents.length && data && <p className="empty-state">Your recent records will appear here.</p>}
          </div>
        </section>
      </div>
      <section className="panel activity-panel">
        <div className="panel-head"><div><span>YOUR WORKSPACE</span><h2>Recent activity</h2></div></div>
        {data?.activity?.length
          ? data.activity.slice(0, 10).map((item) => <div className="activity-event" key={item.id}><strong>{item.summary}</strong><small>{new Date(item.created_at).toLocaleString()}</small></div>)
          : data && <p className="empty-state">Your recent account activity will appear here.</p>}
      </section>
      <section className="panel quick-actions"><div className="panel-head"><div><span>CONTINUE EXPLORING</span><h2>Quick actions</h2></div></div><div className="quick-action-links"><Link to="/schemes"><Search size={17}/> Find schemes</Link><Link to="/documents"><FolderUp size={17}/> Review documents</Link><Link to="/legal"><Scale size={17}/> Ask legal assistant</Link><Link to="/forms"><FileText size={17}/> Prepare a draft</Link><Link to="/applications"><ClipboardList size={17}/> Track applications</Link><Link to="/notifications"><Bell size={17}/> Notifications ({unread.length} unread)</Link></div></section>
      {unread.length > 0 && <section className="panel dashboard-notifications" id="notifications"><div className="panel-head"><div><span>NOTIFICATIONS</span><h2>{unread.length} unread</h2></div><Link to="/notifications">View all</Link></div>{unread.slice(0, 5).map((item) => <p className="notification-row" key={item.id}><span><strong>{item.title}</strong> {item.body}</span><button type="button" className="link-button" onClick={() => markRead(item.id)}>Mark read</button></p>)}</section>}
    </main>
  </>
}
