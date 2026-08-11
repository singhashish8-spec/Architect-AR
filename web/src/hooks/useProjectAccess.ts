import { useState, useEffect } from 'react'
import { getProject, projectRequiresPasscode } from '../services/projectService'
import type { Project } from '../types/Project'
import { getErrorMessage } from '../utils/errorMessage'

export interface UseProjectAccessResult {
  project: Project | null
  loadError: string | null
  // null = still checking whether this project needs a passcode at all --
  // kept distinct from `false` so a passcode-free project renders exactly
  // as before, with no gate flashing on screen even briefly.
  passcodeRequired: boolean | null
  // Returns whether the passcode was accepted -- PasscodeGate shows its
  // own "incorrect" message on false, nothing else to do in that case.
  handlePasscodeSubmit: (passcode: string) => Promise<boolean>
}

// The "does this project need a passcode, then load it" sequence every
// client-facing project page needs -- originally only pages/ProjectView.tsx
// had this, pulled out here once pages/BoqView.tsx needed the exact same
// thing (the standalone BOQ page is just as client-facing, and just as
// passcode-gated, as the 3D viewer is). See
// docs/features/passcode-protected-links.md.
export function useProjectAccess(projectId: string | undefined): UseProjectAccessResult {
  const [project, setProject] = useState<Project | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [passcodeRequired, setPasscodeRequired] = useState<boolean | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    void (async () => {
      try {
        const required = await projectRequiresPasscode(projectId)
        if (cancelled) return
        setPasscodeRequired(required)
        if (required) return // wait for PasscodeGate instead of loading yet

        const result = await getProject(projectId)
        if (!cancelled) {
          setProject(result)
          if (!result) setLoadError('This link doesn’t match a project.')
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, 'Failed to load this project.'))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId])

  async function handlePasscodeSubmit(passcode: string): Promise<boolean> {
    if (!projectId) return false
    const result = await getProject(projectId, passcode)
    if (result) setProject(result)
    return result !== null
  }

  return { project, loadError, passcodeRequired, handlePasscodeSubmit }
}
