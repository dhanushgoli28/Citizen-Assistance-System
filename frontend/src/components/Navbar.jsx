import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { DEMO_MODE_ENABLED } from '../services/demoConfig'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { enterDemo } = useAuth()
  const navigate = useNavigate()
  const exploreDemo = () => {
    if (enterDemo()) navigate('/dashboard')
    setOpen(false)
  }
  return <header className="site-header"><div className="nav-wrap">
    <Link className="brand" to="/"><span className="brand-mark"><ShieldCheck size={22} /></span><span>Citizen<span>Assist</span></span></Link>
    <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
    <nav className={open ? 'nav-links open' : 'nav-links'}>
      <NavLink to="/" end>Home</NavLink><a href="/#services">Services</a><a href="/#how">How it works</a><a href="/#about">About</a><a href="/#contact">Contact</a>
      {DEMO_MODE_ENABLED && <button className="btn btn-ghost" type="button" onClick={exploreDemo}>Explore Demo</button>}<Link className="btn btn-ghost" to="/login">Log in</Link><Link className="btn btn-primary" to="/register">Get Started</Link>
    </nav>
  </div></header>
}
