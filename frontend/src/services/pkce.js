export const PKCE_VERIFIER_STORAGE_KEY = 'cas_auth_code_verifier'
const PKCE_VERIFIER_TTL_MS = 24 * 60 * 60 * 1000

function base64UrlEncode(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createPkcePair() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure browser cryptography is required to register.')
  }

  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const verifier = base64UrlEncode(randomBytes)

  return {
    verifier,
    challenge: await createPkceChallenge(verifier),
  }
}

export async function createPkceChallenge(verifier) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  return base64UrlEncode(new Uint8Array(digest))
}

export function readPkceState() {
  const stored = localStorage.getItem(PKCE_VERIFIER_STORAGE_KEY)
  if (!stored) return null

  try {
    const { verifier, flow, createdAt } = JSON.parse(stored)
    if (
      typeof verifier === 'string'
      && ['signup', 'recovery'].includes(flow)
      && typeof createdAt === 'number'
      && Date.now() - createdAt <= PKCE_VERIFIER_TTL_MS
    ) {
      return { verifier, flow }
    }
  } catch {
    // Replace malformed or expired local callback state.
  }

  localStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY)
  return null
}

export function savePkceVerifier(verifier, flow = 'signup') {
  localStorage.setItem(
    PKCE_VERIFIER_STORAGE_KEY,
    JSON.stringify({ verifier, flow, createdAt: Date.now() }),
  )
}

export function clearPkceVerifier() {
  localStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY)
}
