import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

export default function Footer() {
  return <footer className="footer"><div className="footer-grid"><div><Link className="brand footer-brand" to="/"><span className="brand-mark"><ShieldCheck size={22}/></span><span>Citizen<span>Assist</span></span></Link><p>One platform. Multiple citizen services. Smarter assistance.</p></div>
  <div><h4>Services</h4><Link to="/schemes">Scheme Finder</Link><Link to="/documents">Document Intelligence</Link><Link to="/legal">Legal Assistant</Link><Link to="/forms">Smart Forms</Link></div>
  <div><h4>Information</h4><a href="/#how">How it works</a><a href="/#contact">Contact & support</a><a href="/#privacy">Privacy notice</a><a href="/#terms">Use of assistance</a></div></div><div className="footer-bottom"><span>© 2026 CitizenAssist</span><span>Independent assistance platform · Not a government authority</span></div></footer>
}
