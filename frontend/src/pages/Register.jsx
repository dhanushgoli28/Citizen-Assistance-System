import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { register, resendVerification } from '../services/authService'
import {
  clearPkceVerifier,
  createPkcePair,
  createPkceChallenge,
  readPkceState,
  savePkceVerifier,
} from '../services/pkce'

export default function Register() {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resending, setResending] = useState(false)
  const [busy, setBusy] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (form.name.trim().length < 2) return setError('Enter your full name.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')

    setBusy(true)
    try {
      const { verifier, challenge } = await createPkcePair()
      savePkceVerifier(verifier, 'signup')
      const { data } = await register({
        full_name: form.name.trim(),
        email: form.email,
        password: form.password,
        code_challenge: challenge,
        code_challenge_method: 's256',
      })
      if (data.access_token && data.user) {
        clearPkceVerifier()
        loginUser(data)
        navigate('/dashboard')
      } else {
        setNotice(data.message || 'Account created. Check your email to verify your address before signing in.')
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail
          || requestError.message
          || 'Unable to reach the registration service.',
      )
    } finally {
      setBusy(false)
    }
  }

  const resendEmail = async () => {
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Enter your email address to request another verification email.')
      return
    }
    setResending(true)
    setError('')
    try {
      const state = readPkceState()
      const payload = { email: form.email }
      if (state?.flow === 'signup') {
        payload.code_challenge = await createPkceChallenge(state.verifier)
        payload.code_challenge_method = 's256'
      }
      const { data } = await resendVerification(payload)
      setNotice(data.message)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'A new verification email could not be requested.')
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="auth-page">
      <Link className="auth-back" to="/"><ArrowLeft size={17} /> Back to home</Link>
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><ShieldCheck /></span><strong>CitizenAssist</strong></div>
        <h1>Create your account</h1>
        <p>Start discovering assistance tailored to you.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <div className="form-notice" role="status">{notice}</div>}
        <form onSubmit={submit}>
          <label>Full name
            <input
              required minLength="2" maxLength="120" placeholder="Enter your name"
              value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>Email address
            <input
              type="email" required placeholder="you@example.com"
              value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>Password
            <div className="password-field">
              <input
                type={show ? 'text' : 'password'} minLength="8" maxLength="128" required
                placeholder="At least 8 characters" value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password visibility">
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <label className="check terms">
            <input type="checkbox" required /> I agree to the <Link to="/#terms">Terms of Use</Link> and <Link to="/#privacy">Privacy Policy</Link>
          </label>
          <button disabled={busy} className="btn btn-primary auth-submit">
            {busy ? 'Creating account…' : 'Create account'}
          </button>
          <button type="button" className="link-button" disabled={resending || busy} onClick={resendEmail}>
            {resending ? 'Sending verification email…' : 'Resend verification email'}
          </button>
        </form>
        <div className="auth-switch">Already have an account? <Link to="/login">Log in</Link></div>
      </section>
    </main>
  )
}
