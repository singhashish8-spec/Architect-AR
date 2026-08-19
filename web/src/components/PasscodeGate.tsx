import { useState, type FormEvent } from 'react'
import styles from '../styles/form.module.css'

interface PasscodeGateProps {
  // Returns whether the passcode was accepted -- the caller (ProjectView)
  // is the one that actually knows, since it's the one holding the
  // project state that gets populated on success.
  onSubmit: (passcode: string) => Promise<boolean>
  // Defaults match the original per-project gate's copy -- overridden by
  // pages/AdminDashboard.tsx, which reuses this same component for its
  // own passcode gate rather than duplicating the form. See
  // docs/features/analytics-and-admin-dashboard.md.
  title?: string
  description?: string
  submitLabel?: string
}

// Shown instead of the viewer when project_requires_passcode() says a
// project has one set. See docs/features/passcode-protected-links.md.
export function PasscodeGate({
  onSubmit,
  title = 'Enter passcode',
  description = 'This project is protected. Ask whoever shared this link for the passcode.',
  submitLabel = 'View project',
}: PasscodeGateProps) {
  const [passcode, setPasscode] = useState('')
  const [checking, setChecking] = useState(false)
  const [wrongPasscode, setWrongPasscode] = useState(false)
  // Separate from wrongPasscode -- onSubmit throwing (a network failure,
  // a misconfigured Supabase client, the RPC itself erroring) is a
  // different problem than a real wrong passcode, and was previously
  // swallowed silently: the form just reset to normal with no message at
  // all, indistinguishable from nothing having happened.
  const [checkFailed, setCheckFailed] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setChecking(true)
    setWrongPasscode(false)
    setCheckFailed(false)
    try {
      const accepted = await onSubmit(passcode)
      if (!accepted) setWrongPasscode(true)
    } catch {
      setCheckFailed(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{description}</p>
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
          {checkFailed && (
            <p role="alert" className={styles.error}>
              Couldn't reach the server to check the passcode. Check your
              connection and try again.
            </p>
          )}
          <button type="submit" className={styles.button} disabled={checking || !passcode}>
            {checking ? 'Checking…' : submitLabel}
          </button>
        </form>
      </div>
    </main>
  )
}
