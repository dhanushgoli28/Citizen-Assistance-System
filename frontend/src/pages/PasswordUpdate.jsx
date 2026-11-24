import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { updatePassword } from '../services/authService'

export default function PasswordUpdate() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmation) return setError('Passwords do not match.')
    setBusy(true)
    try {
      await updatePassword({ password })
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Password could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-page">
    <Link className="auth-back" to="/login">Back to login</Link>
    <section className="auth-card">
      <div className="auth-brand"><span className="brand-mark"><ShieldCheck/></span><strong>CitizenAssist</strong></div>
      <h1>Choose a new password</h1>
      <p>Your verified recovery session is required to update your password.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <label>New password<input required type="password" minLength="8" maxLength="128" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)}/></label>
        <label>Confirm password<input required type="password" minLength="8" maxLength="128" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/></label>
        <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      </form>
    </section>
  </main>
}
