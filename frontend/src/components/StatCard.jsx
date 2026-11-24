export default function StatCard({ icon: Icon, label, value, tone, detail }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={21}/></div><div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div></article>
}
