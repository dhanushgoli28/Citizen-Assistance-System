import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { login, resetPassword } from '../services/authService'
import { createPkcePair, savePkceVerifier } from '../services/pkce'
import { DEMO_MODE_ENABLED } from '../services/demoConfig'

export default function Login() {
  const [show, setShow] = useState(false), [resetMode, setResetMode] = useState(false), [form, setForm] = useState({email:'',password:''}), [error,setError]=useState(''), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false)
  const { loginUser, enterDemo } = useAuth(), navigate = useNavigate()
  const exploreDemo = () => {
    if (enterDemo()) navigate('/dashboard')
  }
  const submit = async (e) => {
    e.preventDefault()
    setError(''); setNotice('')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.')
    setBusy(true)
    try {
      if (resetMode) {
        const { verifier, challenge } = await createPkcePair()
        savePkceVerifier(verifier, 'recovery')
        const { data } = await resetPassword({
          email: form.email,
          code_challenge: challenge,
          code_challenge_method: 's256',
        })
        setNotice(data.message)
      } else {
        const { data } = await login({ email: form.email, password: form.password })
        if (!data.access_token || !data.user) throw new Error('The server did not return a valid sign-in session.')
        loginUser(data)
        navigate('/dashboard')
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message || 'Unable to reach the sign-in service.')
    } finally {
      setBusy(false)
    }
  }
  return <main className="auth-page"><Link className="auth-back" to="/"><ArrowLeft size={17}/> Back to home</Link><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><ShieldCheck/></span><strong>CitizenAssist</strong></div><h1>{resetMode ? 'Reset your password' : 'Welcome back'}</h1><p>{resetMode ? 'We’ll send reset instructions if an account exists for this email.' : 'Sign in to continue to your citizen dashboard.'}</p>{error&&<div className="form-error" role="alert">{error}</div>}{notice&&<div className="form-notice" role="status">{notice}</div>}<form onSubmit={submit}><label>Email address<input type="email" required placeholder="you@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>{!resetMode&&<label>Password<div className="password-field"><input type={show?'text':'password'} required placeholder="Enter your password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div></label>}{!resetMode&&<div className="form-row"><label className="check"><input type="checkbox"/> Remember me</label><button className="link-button" type="button" onClick={()=>{setResetMode(true);setError('');setNotice('')}}>Forgot password?</button></div>}<button disabled={busy} className="btn btn-primary auth-submit">{busy ? 'Please wait…' : resetMode ? 'Send reset instructions' : 'Log in'}</button>{resetMode&&<button className="link-button reset-back" type="button" onClick={()=>{setResetMode(false);setError('');setNotice('')}}>Back to log in</button>}</form>{DEMO_MODE_ENABLED && <button type="button" className="btn btn-secondary auth-submit" onClick={exploreDemo}>Explore Demo — no account needed</button>}<div className="auth-switch">New to CitizenAssist? <Link to="/register">Create an account</Link></div></section></main>
}
