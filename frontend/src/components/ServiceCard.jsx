import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
export default function ServiceCard({ icon: Icon, title, text, to, tone }) {
  return <Link className="service-card" to={to}><div className={`service-icon ${tone}`}><Icon size={25}/></div><h3>{title}</h3><p>{text}</p><span>Explore service <ArrowRight size={16}/></span></Link>
}
