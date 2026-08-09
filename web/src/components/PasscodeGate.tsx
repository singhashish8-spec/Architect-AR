import { useState, type FormEvent } from 'react'
import styles from '../styles/form.module.css'

interface PasscodeGateProps {
  // Returns whether the passcode was accepted -- the caller (ProjectView)
  // is the one that actually knows, since it's the one holding the
  // project state that gets populated on success.
  onSubmit: (passcode: string) => Promise<boolean>
}

// Shown instead of the viewer when project_requires_passcode() says a
// project has one set. See docs/features/passcode-protected-links.md.
export function PasscodeGate({ onSubmit }: PasscodeGateProps) {
  const [passcode, setPasscode] = useState('')
  const [checking, setChecking] = useState(false)
  const [wrongPasscode, setWrongPasscode] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setChecking(true)
    setWrongPasscode(false)
    try {
      const accepted = await onSubmit(passcode)
      if (!accepted) setWrongPasscode(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Enter passcode</h1>
        <p className={styles.subtitle}>
          This project is protected. Ask whoever shared this link for the passcode.
        </p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className={styles.field}>
            <label htmlFor="gate-passcode" className={styles.label}>
              Passcode
            </label>
            <input
              id="gate-passcode"
              type="password"
              autoFocus
              className={styles.input}
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
            />
          </div>
          {wrongPasscode && (
            <p role="alert" className={styles.error}>
              Incorrect passcode. Try again.
            </p>
          )}
          <button type="submit" className={styles.button} disabled={checking || !passcode}>
            {checking ? 'Checking…' : 'View project'}
          </button>
        </form>
      </div>
    </main>
  )
}
