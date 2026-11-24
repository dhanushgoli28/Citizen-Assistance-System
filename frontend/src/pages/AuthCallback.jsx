import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  exchangeAuthCode,
  getCurrentUser,
  verifyEmail,
} from '../services/authService'
import { clearPkceVerifier, readPkceState } from '../services/pkce'

function getCallbackValue(query, hash, name) {
  return query.get(name) || hash.get(name)
}

export default function AuthCallback() {
  const [error, setError] = useState('')
  const started = useRef(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (started.current) return
    started.current = true

    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const code = getCallbackValue(query, hash, 'code')
    const tokenHash = getCallbackValue(query, hash, 'token_hash')
    const type = getCallbackValue(query, hash, 'type')
    const accessToken = getCallbackValue(query, hash, 'access_token')
    const refreshToken = getCallbackValue(query, hash, 'refresh_token')
    const callbackError = getCallbackValue(query, hash, 'error_description')
      || getCallbackValue(query, hash, 'error')

    window.history.replaceState(null, '', '/auth/callback')

    const completeAuthentication = async () => {
      try {
        if (callbackError) throw new Error(callbackError)

        let session
        let pkceState = null
        if (code) {
          pkceState = readPkceState()
          if (!pkceState) {
            throw new Error(
              'This verification link needs the browser used to register. Return to that browser and open the email link again.',
            )
          }
          const { data } = await exchangeAuthCode({
            code,
            code_verifier: pkceState.verifier,
          })
          session = data
        } else if (tokenHash) {
          if (!['signup', 'recovery'].includes(type)) {
            throw new Error('This link is not a supported email-verification link.')
          }
          const { data } = await verifyEmail({
            token_hash: tokenHash,
            type,
          })
          session = data
        } else if (accessToken) {
          session = {
            access_token: accessToken,
            refresh_token: refreshToken,
          }
        } else {
          throw new Error('The verification link is missing its authentication details.')
        }

        if (!session.access_token) {
          throw new Error('Email verification did not establish a sign-in session.')
        }

        const { data: user } = await getCurrentUser(session.access_token)
        if (session.user?.id && session.user.id !== user.id) {
          throw new Error('The verified session did not match the returned account.')
        }

        const flow = type || pkceState?.flow || 'signup'
        if (!['signup', 'recovery'].includes(flow)) {
          throw new Error('The authentication callback has an unsupported flow.')
        }
        clearPkceVerifier()
        loginUser({
          ...session,
          user: {
            ...(session.user || {}),
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
          },
        })
        navigate(flow === 'recovery' ? '/password/update' : '/dashboard', { replace: true })
      } catch (requestError) {
        const detail = requestError.response?.data?.detail
        setError(typeof detail === 'string'
          ? detail
          : requestError.message || 'Email verification could not be completed.')
      }
    }

    completeAuthentication()
  }, [loginUser, navigate])

  return (
    <main className="auth-page">
      <section className="auth-card" aria-live="polite">
        <div className="auth-brand"><span className="brand-mark"><ShieldCheck /></span><strong>CitizenAssist</strong></div>
        <h1>{error ? 'Verification could not be completed' : 'Verifying your email'}</h1>
        {error
          ? <><div className="form-error" role="alert">{error}</div><Link className="btn btn-primary reset-back" to="/login">Continue to login</Link></>
          : <p>Please wait while we securely verify your email and sign you in.</p>}
      </section>
    </main>
  )
}
