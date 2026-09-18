import { type FormEvent, useEffect, useState } from 'react'
import './App.css'

type User = {
  id: string
  name: string
  email: string
}

const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'testpass'

function App() {
  const [name, setName] = useState('Demo User')
  const [email, setEmail] = useState(TEST_EMAIL)
  const [password, setPassword] = useState(TEST_PASSWORD)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkAuth = async () => {
    setIsCheckingAuth(true)
    try {
      const response = await fetch('/api/me', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = (await response.json()) as { user: User }
        setUser(data.user)
        setError(null)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Auth check failed', err)
      setUser(null)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  useEffect(() => {
    void checkAuth()
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(isSigningUp ? '/api/signup' : '/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(isSigningUp ? { name, email, password } : { email, password }),
      })

      const data = (await response.json().catch(() => null)) as
        | { user?: User; detail?: string }
        | null

      if (!response.ok) {
        throw new Error(data?.detail ?? (isSigningUp ? 'Sign up failed' : 'Login failed'))
      }

      if (isSigningUp) {
        setIsSigningUp(false)
        setPassword(TEST_PASSWORD)
        setError('Account created. Sign in to continue.')
      } else {
        setUser(data?.user ?? { id: '', name: email, email })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setUser(null)
      setError(null)
      setPassword(TEST_PASSWORD)
    }
  }

  if (isCheckingAuth) {
    return (
      <main className="screen">
        <div className="card loading-card">
          <p>Checking authentication...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="screen">
        <div className="card auth-card">
          <div className="badge">Secure access</div>
          <h1>{isSigningUp ? 'Create account' : 'Welcome back'}</h1>
          <p className="subtitle">
            {isSigningUp ? 'Create an account to get started.' : 'Sign in to continue to your account.'}
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            {isSigningUp ? (
              <label>
                <span>Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                />
              </label>
            ) : null}

            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                required
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Working...' : isSigningUp ? 'Create account' : 'Login'}
            </button>
          </form>

          <button
            type="button"
            className="mode-button"
            onClick={() => {
              setIsSigningUp((current) => !current)
              setError(null)
            }}
          >
            {isSigningUp ? 'Already have an account? Login' : 'Need an account? Sign up'}
          </button>

          {!isSigningUp ? (
            <div className="demo-credentials">
              <span>Demo credentials</span>
              <strong>{TEST_EMAIL}</strong>
              <strong>{TEST_PASSWORD}</strong>
            </div>
          ) : null}
        </div>
      </main>
    )
  }

  return (
    <main className="screen home-screen">
      <div className="card home-card">
        <div className="badge success-badge">Authenticated</div>
        <h1>Home</h1>
        <p className="welcome-text">Hello, {user.name}.</p>
        <p className="subtitle">You are logged in and the backend has verified your session.</p>

        <button type="button" className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </main>
  )
}

export default App
