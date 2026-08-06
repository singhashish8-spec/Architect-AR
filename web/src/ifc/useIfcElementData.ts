import { useEffect, useRef, useState } from 'react'
import { loadIfcModel, type IfcModel } from './loadIfcModel'
import { buildGlobalIdIndex, getElementData } from './ifcPropertyLookup'
import type { IfcElementData } from '../types/IfcElementData'

interface UseIfcElementDataResult {
  loading: boolean
  error: Error | null
  // Looks up an element by its IFC GlobalId -- the value expected to be
  // embedded in the matching glTF node's name, correlating the two
  // separately-exported files. See
  // docs/features/element-data-inspection.md.
  getElementDataByGlobalId: (globalId: string) => Promise<IfcElementData | null>
}

export function useIfcElementData(ifcUrl: string | null): UseIfcElementDataResult {
  const [loading, setLoading] = useState(Boolean(ifcUrl))
  const [error, setError] = useState<Error | null>(null)
  const modelRef = useRef<IfcModel | null>(null)
  const indexRef = useRef<Map<string, number> | null>(null)

  useEffect(() => {
    let cancelled = false

    // All state updates live inside this inner async function, including
    // the no-op case below -- not called synchronously in the effect body
    // itself, since React (react-hooks/set-state-in-effect) wants effects
    // to synchronize with the external IFC-loading process, not set state
    // directly as their first action.
    void (async () => {
      if (!ifcUrl) {
        setLoading(false)
        return
      }

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

    return () => {
      cancelled = true
    }
  }, [ifcUrl])

  async function getElementDataByGlobalId(globalId: string): Promise<IfcElementData | null> {
    const model = modelRef.current
    const index = indexRef.current
    if (!model || !index) return null
    const expressId = index.get(globalId)
    if (expressId === undefined) return null
    return getElementData(model.api, model.modelId, expressId)
  }

  return { loading, error, getElementDataByGlobalId }
}
