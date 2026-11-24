import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { LayoutDashboard, Search, FolderUp, Scale, FileText, LogOut, UserRound, ClipboardList, Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const [logoutError, setLogoutError] = useState('')
  const handleLogout = async () => {
    const error = await logout()
    setLogoutError(error ? 'Server sign-out could not be confirmed.' : '')
  }
  const items = [
    ['/dashboard', LayoutDashboard, 'Overview'], ['/schemes', Search, 'Scheme Finder'], ['/documents', FolderUp, 'Documents'], ['/legal', Scale, 'Legal Assistant'], ['/forms', FileText, 'Smart Forms'], ['/applications', ClipboardList, 'Applications'], ['/notifications', Bell, 'Notifications'], ['/profile', UserRound, 'Profile'],
  ]
  return <aside className="sidebar"><NavLink className="brand sidebar-brand" to="/"><span className="brand-mark"><Scale size={20}/></span><span>Citizen<span>Assist</span></span></NavLink>
    <nav className="side-links">{items.map(([to, Icon, label]) => <NavLink key={to} to={to} aria-label={label}><Icon size={19}/><span>{label}</span></NavLink>)}<button className="mobile-logout" onClick={handleLogout} title="Log out"><LogOut size={19}/><span>Log out</span></button></nav>
    <div className="sidebar-user"><div className="avatar">{(user?.name || 'Citizen').slice(0,1)}</div><div><strong>{user?.name || 'Citizen User'}</strong><small>{user?.email || ''}</small>{logoutError && <small role="alert">{logoutError}</small>}</div><button onClick={handleLogout} title="Log out"><LogOut size={17}/></button></div>
  </aside>
}
