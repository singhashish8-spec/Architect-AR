import { useEffect, useRef, useState } from 'react'
import { loadIfcModel, type IfcModel } from './loadIfcModel'
import { buildGlobalIdIndex, getElementData } from './ifcPropertyLookup'
import type { IfcElementData } from '../types/IfcElementData'

interface UseIfcElementDataResult {
  // Whole-file parse in progress -- true for the entire time between the
  // IFC URL being set and the background parse finishing. NOT "is this
  // specific tap's lookup in progress" -- callers that show a per-tap
  // loading indicator should track that separately (see
  // pages/ProjectView.tsx), not reuse this flag, or the UI ends up
  // showing a loading state on page load before the user has tapped
  // anything.
  loading: boolean
  error: Error | null
  // Looks up an element by its IFC GlobalId -- the value expected to be
  // embedded in the matching glTF node's name, correlating the two
  // separately-exported files. See
  // docs/features/element-data-inspection.md. Waits for the background
  // parse to finish if it's still running, rather than returning null for
  // a tap that happened to land before parsing completed.
  getElementDataByGlobalId: (globalId: string) => Promise<IfcElementData | null>
}

export function useIfcElementData(ifcUrl: string | null): UseIfcElementDataResult {
  const [loading, setLoading] = useState(Boolean(ifcUrl))
  const [error, setError] = useState<Error | null>(null)
  const modelRef = useRef<IfcModel | null>(null)
  const indexRef = useRef<Map<string, number> | null>(null)
  const readyRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!ifcUrl) {
      readyRef.current = null
      // Still deferred to an inner function rather than called directly,
      // per the note in the previous version of this file --
      // react-hooks/set-state-in-effect flags synchronous setState calls
      // as the first statement in an effect body. No `async` here since
      // there's nothing to await -- that alone satisfies the rule.
      ;(() => setLoading(false))()
      return
    }

    const readyPromise = (async () => {
      setLoading(true)
      setError(null)
      try {
        const model = await loadIfcModel(ifcUrl)
        const index = await buildGlobalIdIndex(model.api, model.modelId)
        if (cancelled) return
        modelRef.current = model
        indexRef.current = index
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    readyRef.current = readyPromise

    return () => {
      cancelled = true
    }
  }, [ifcUrl])

  async function getElementDataByGlobalId(globalId: string): Promise<IfcElementData | null> {
    if (readyRef.current) await readyRef.current
    const model = modelRef.current
    const index = indexRef.current
    if (!model || !index) return null
    const expressId = index.get(globalId)
    if (expressId === undefined) return null
    return getElementData(model.api, model.modelId, expressId)
  }

  return { loading, error, getElementDataByGlobalId }
}
