import { useCallback, useEffect, useRef, useState } from 'react'
import { loadIfcModel, type IfcModel } from './loadIfcModel'
import {
  buildGlobalIdIndex,
  getElementData,
  invertToHyphenatedGlobalIds,
  resolveNodeNameToExpressId,
} from './ifcPropertyLookup'
import { getLevelsAndRooms, type Level } from './ifcSpatialTree'
import { getElementCategories, type ElementCategory } from './ifcCategories'
import { buildBoqDetails, type BoqElementDetail } from './ifcBoqDetails'
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
  // Looks up an element from a glTF node's name, correlating the two
  // separately-exported files -- handles both the compressed GlobalId
  // form and the expanded-UUID form some exporters use (see
  // ifcPropertyLookup.ts's resolveNodeNameToExpressId). See
  // docs/features/element-data-inspection.md. Waits for the background
  // parse to finish if it's still running, rather than returning null for
  // a tap that happened to land before parsing completed.
  getElementDataByGlobalId: (nodeName: string) => Promise<IfcElementData | null>
  // Empty until the background parse finishes (or if there's no IFC file
  // at all) -- see docs/features/levels-and-rooms-navigation.md.
  levels: Level[]
  // Same timing as `levels` -- see docs/features/category-and-discipline-visibility.md.
  categories: ElementCategory[]
  // Bulk-fetches every classified element's level/material/quantities for
  // the BOQ panel (ifc/ifcBoqDetails.ts) -- unlike `levels`/`categories`,
  // NOT computed automatically on load, since it costs two extra WASM
  // calls per element on top of what's already fetched. Only actually
  // runs the first time it's called; the result is cached (per model) for
  // every call after that, so reopening the BOQ panel later in the same
  // session is instant. See docs/features/boq.md.
  getBoqDetails: (onProgress?: (done: number, total: number) => void) => Promise<BoqElementDetail[]>
}

export function useIfcElementData(ifcUrl: string | null): UseIfcElementDataResult {
  const [loading, setLoading] = useState(Boolean(ifcUrl))
  const [error, setError] = useState<Error | null>(null)
  const [levels, setLevels] = useState<Level[]>([])
  const [categories, setCategories] = useState<ElementCategory[]>([])
  const modelRef = useRef<IfcModel | null>(null)
  const indexRef = useRef<Map<string, number> | null>(null)
  const readyRef = useRef<Promise<void> | null>(null)
  // Mirrors the `levels`/`categories` state, but as refs -- getBoqDetails()
  // below reads these right after awaiting readyRef.current, which can
  // resolve before React has actually re-rendered with the newest
  // setLevels/setCategories values. Written at the same point in the load
  // IIFE as the matching setState call, so they're guaranteed current by
  // the time that IIFE's promise resolves, regardless of render timing.
  const levelsRef = useRef<Level[]>([])
  const categoriesRef = useRef<ElementCategory[]>([])
  const boqRef = useRef<Promise<BoqElementDetail[]> | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!ifcUrl) {
      readyRef.current = null
      boqRef.current = null
      levelsRef.current = []
      categoriesRef.current = []
      // Still deferred to an inner function rather than called directly,
      // per the note in the previous version of this file --
      // react-hooks/set-state-in-effect flags synchronous setState calls
      // as the first statement in an effect body. No `async` here since
      // there's nothing to await -- that alone satisfies the rule.
      ;(() => {
        setLoading(false)
        setLevels([])
        setCategories([])
      })()
      return
    }

    // A fresh model invalidates any BOQ details built for whatever was
    // loaded before -- reset the cache up front, not just on error, so a
    // getBoqDetails() call that lands mid-reload can never resolve with
    // the previous model's data.
    boqRef.current = null

    const readyPromise = (async () => {
      setLoading(true)
      setError(null)
      try {
        const model = await loadIfcModel(ifcUrl)
        const index = await buildGlobalIdIndex(model.api, model.modelId)
        if (cancelled) return
        modelRef.current = model
        indexRef.current = index

        const expressIdToGlobalId = invertToHyphenatedGlobalIds(index)
        const levelList = await getLevelsAndRooms(model.api, model.modelId, expressIdToGlobalId)
        if (cancelled) return
        levelsRef.current = levelList
        setLevels(levelList)

        const categoryList = getElementCategories(model.api, model.modelId, expressIdToGlobalId)
        if (cancelled) return
        categoriesRef.current = categoryList
        setCategories(categoryList)
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

  async function getElementDataByGlobalId(nodeName: string): Promise<IfcElementData | null> {
    if (readyRef.current) await readyRef.current
    const model = modelRef.current
    const index = indexRef.current
    if (!model || !index) return null
    const expressId = resolveNodeNameToExpressId(nodeName, index)
    if (expressId === undefined) return null
    return getElementData(model.api, model.modelId, expressId)
  }

  // Wrapped in useCallback (empty deps -- only ever touches refs, never
  // closed-over state, so there's no staleness risk) so BoqPanel.tsx can
  // safely list it in an effect's own dependency array to trigger its
  // lazy load-on-open. Without this, a fresh function identity every
  // render would either need to be left out of that dependency array
  // (an exhaustive-deps lint violation) or would re-fire the effect on
  // every unrelated re-render -- the exact "inline callback + effect
  // dependency + state update" freeze-regression shape documented in
  // docs/features/levels-and-rooms-navigation.md, fixed there the same
  // way.
  const getBoqDetails = useCallback(
    async (onProgress?: (done: number, total: number) => void): Promise<BoqElementDetail[]> => {
      if (readyRef.current) await readyRef.current
      const model = modelRef.current
      if (!model) return []
      // onProgress only reaches the call that actually kicks off the
      // build -- a second call issued while the first is still in
      // flight shares its result instead of starting a redundant pass,
      // so it doesn't get its own progress callbacks. Acceptable: the
      // BOQ panel only ever has one open instance of itself calling
      // this at a time.
      if (!boqRef.current) {
        boqRef.current = buildBoqDetails(model.api, model.modelId, categoriesRef.current, levelsRef.current, {
          onProgress,
        })
      }
      return boqRef.current
    },
    [],
  )

  return { loading, error, getElementDataByGlobalId, levels, categories, getBoqDetails }
}
