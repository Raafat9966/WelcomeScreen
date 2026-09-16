import { type FormEvent, useEffect, useState } from 'react'
import './App.css'

type User = {
  username: string
}

const TEST_USER = 'testuser'
const TEST_PASSWORD = 'testpass'

function App() {
  const [username, setUsername] = useState(TEST_USER)
  const [password, setPassword] = useState(TEST_PASSWORD)
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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = (await response.json().catch(() => null)) as
        | { user?: User; detail?: string }
        | null

      if (!response.ok) {
        throw new Error(data?.detail ?? 'Login failed')
      }

      setUser(data?.user ?? { username })
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
          <div className="badge">Secure login</div>
          <h1>Welcome back</h1>
          <p className="subtitle">Use the demo account to enter the app.</p>

          <form onSubmit={handleLogin} className="login-form">
            <label>
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="testuser"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="testpass"
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="demo-credentials">
            <span>Demo credentials</span>
            <strong>{TEST_USER}</strong>
            <strong>{TEST_PASSWORD}</strong>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="screen home-screen">
      <div className="card home-card">
        <div className="badge success-badge">Authenticated</div>
        <h1>Home</h1>
        <p className="welcome-text">Hello, {user.username}.</p>
        <p className="subtitle">You are logged in and the backend has verified your session.</p>

        <button type="button" className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </main>
  )
}

export default App
