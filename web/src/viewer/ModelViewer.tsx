import { forwardRef, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { resolveNodeNameToExpressId } from '../ifc/ifcPropertyLookup'
import type { ScalePreset } from '../types/ScalePreset'
import { visualScale } from '../types/ScalePreset'
import type { LightingPreset } from '../types/LightingPreset'
import { BASE_LIGHT_CONFIGS, LIGHTFORMER_CONFIGS } from '../types/LightingPreset'

export interface ModelViewerHandle {
  // Frames the camera around every mesh whose name resolves to one of
  // these GlobalIds. Used by the levels/rooms navigator (ProjectView.tsx)
  // to "jump to" a level or room -- spatial containers themselves usually
  // have no mesh of their own to point the camera at directly, so this
  // frames whatever elements IFC says the level/room actually contains.
  // See ifc/ifcSpatialTree.ts and docs/features/levels-and-rooms-navigation.md.
  focusOnGlobalIds: (globalIds: string[]) => void
}

interface ModelViewerProps {
  modelUrl: string
  scalePreset: ScalePreset
  // Called with the clicked element's IFC GlobalId (read from the glTF
  // node's name) -- null if the exporter didn't preserve one for that
  // node. See docs/features/element-data-inspection.md.
  onElementSelect?: (globalId: string) => void
  // Meshes resolving to one of these GlobalIds are hidden; everything
  // else stays visible. Recomputed in full on every change (rather than
  // diffed against the previous set) -- simpler, and cheap enough at the
  // element counts this app deals with. See
  // docs/features/category-and-discipline-visibility.md.
  hiddenGlobalIds?: Set<string>
  // Client-side-only viewing preference, not persisted anywhere -- see
  // docs/features/lighting-presets.md. Defaults to 'daylight'.
  lightingPreset?: LightingPreset
}

function Model({
  modelUrl,
  scalePreset,
  onElementSelect,
  onSceneReady,
  hiddenGlobalIds,
}: {
  modelUrl: string
  scalePreset: ScalePreset
  onElementSelect?: (globalId: string) => void
  onSceneReady: (scene: THREE.Object3D) => void
  hiddenGlobalIds?: Set<string>
}) {
  const { scene } = useGLTF(modelUrl)

  useEffect(() => {
    onSceneReady(scene)
  }, [scene, onSceneReady])

  useEffect(() => {
    const targetIndex = new Map(Array.from(hiddenGlobalIds ?? []).map((id, index) => [id, index]))
    scene.traverse((object) => {
      // Reuses the same node-name resolution tap-to-inspect and the
      // camera-focus feature rely on -- an object with no resolvable IFC
      // identity at all (a group node, an unnamed mesh) always comes back
      // "not matched" here and stays visible, which is what we want: only
      // elements explicitly in the hidden set get hidden, nothing else.
      object.visible = resolveNodeNameToExpressId(object.name, targetIndex) === undefined
    })
  }, [scene, hiddenGlobalIds])

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    const globalId = event.object.name
    if (globalId && onElementSelect) {
      onElementSelect(globalId)
    }
  }

  return <primitive object={scene} scale={visualScale(scalePreset)} onClick={handleClick} />
}

// A fixed camera distance works uniformly across every scale preset
// because the model itself is scaled by visualScale() above -- a 1:1000
// site and a 1:1 room end up roughly comparable in on-screen size.
const CAMERA_DISTANCE = 5

// Shared by both the "jump to a level/room" handler and the auto-frame-
// on-load effect below -- points the camera at box's center from
// whatever direction it's currently facing, and (this is the actual
// fix) moves OrbitControls' own pivot point to that same center.
// Without the controls.target line, OrbitControls keeps orbiting around
// wherever it last was -- its own default, world origin (0, 0, 0),
// until something explicitly moves it. A Revit-exported model is almost
// never centered exactly at the origin (real-world/shared-coordinates
// survey points routinely put a building thousands of units away from
// it), so every rotation before ever using "jump to" pivoted around
// empty space nowhere near the visible geometry -- not an AR issue at
// all, this is the in-app preview's own OrbitControls never having been
// told where the model actually is.
function frameCameraOnBox(camera: THREE.Camera, controls: OrbitControlsImpl, box: THREE.Box3) {
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  // The floor here only exists to avoid a zero/degenerate radius (a
  // single flat-thickness mesh) -- it must NOT be a fixed real-world
  // size like "0.5 units". visualScale() (see types/ScalePreset.ts)
  // shrinks the whole model's geometry by the scale preset's ratio, so
  // a real room's actual bounding box in scene units is already
  // proportionally tiny at anything other than 1:1 -- a fixed 0.5 floor
  // silently dominated every room's real size at 1:100 or smaller,
  // making every "jump to" land at roughly the same distance regardless
  // of which room was clicked (this is exactly what the owner hit
  // testing live: the list worked, the jump didn't visibly move).
  const radius = Math.max(size.x, size.y, size.z, 1e-6)

  const viewDirection = camera.position.clone().sub(controls.target)
  // A zero-length direction (camera sitting exactly on the old target,
  // e.g. the very first frame before anything has moved it) can't be
  // normalized into a real direction -- fall back to a fixed diagonal
  // instead of leaving the camera parked inside the model.
  if (viewDirection.lengthSq() < 1e-9) viewDirection.set(1, 1, 1)
  viewDirection.normalize().multiplyScalar(radius * 2.2)
  camera.position.copy(center.clone().add(viewDirection))
  camera.lookAt(center)
  controls.target.copy(center)
  controls.update()
}

// Lives inside <Canvas> (unlike ModelViewer itself) since framing the
// camera needs useThree() for the live camera instance, which only works
// inside the R3F tree. Exposes its one-shot "focus" action back out to
// ModelViewer's forwardRef via a plain ref callback rather than its own
// useImperativeHandle, since this component isn't the one the caller
// holds a ref to.
function CameraRig({
  sceneRef,
  sceneVersion,
  focusHandlerRef,
}: {
  sceneRef: React.RefObject<THREE.Object3D | null>
  // Bumped (see ModelViewer below) each time a model actually finishes
  // loading -- modelUrl alone changes too early to key this effect on,
  // since it changes the instant a switch is requested, well before the
  // new GLB's Suspense boundary has actually resolved and populated
  // sceneRef.
  sceneVersion: number
  focusHandlerRef: React.RefObject<((globalIds: string[]) => void) | null>
}) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsImpl>(null)

  // Auto-frames the whole model the moment it's actually loaded (initial
  // load, and again on switching to a different model) -- see
  // frameCameraOnBox's comment for why this is needed at all: without
  // it, OrbitControls silently keeps pivoting around world origin until
  // something else (a level/room "jump to") happens to move it first.
  useEffect(() => {
    const scene = sceneRef.current
    const controls = controlsRef.current
    if (!scene || !controls || sceneVersion === 0) return
    const box = new THREE.Box3().setFromObject(scene)
    if (box.isEmpty()) return
    frameCameraOnBox(camera, controls, box)
  }, [camera, sceneRef, sceneVersion])

  useEffect(() => {
    focusHandlerRef.current = (globalIds: string[]) => {
      const scene = sceneRef.current
      const controls = controlsRef.current
      if (!scene || !controls || globalIds.length === 0) return

      // Reuses the same node-name resolution tap-to-inspect relies on
      // (ifc/ifcPropertyLookup.ts) so "does this mesh belong to the
      // target set" is answered identically regardless of which
      // node-naming convention the exporter used.
      const targetIndex = new Map(globalIds.map((id, index) => [id, index]))
      const box = new THREE.Box3()
      let found = false

      scene.traverse((object) => {
        if (resolveNodeNameToExpressId(object.name, targetIndex) !== undefined) {
          box.expandByObject(object)
          found = true
        }
      })

      if (!found) return

      frameCameraOnBox(camera, controls, box)
    }
  }, [camera, sceneRef, focusHandlerRef])

  return <OrbitControls ref={controlsRef} />
}

export const ModelViewer = forwardRef<ModelViewerHandle, ModelViewerProps>(function ModelViewer(
  { modelUrl, scalePreset, onElementSelect, hiddenGlobalIds, lightingPreset = 'daylight' },
  ref,
) {
  const sceneRef = useRef<THREE.Object3D | null>(null)
  const focusHandlerRef = useRef<((globalIds: string[]) => void) | null>(null)
  // Starts at 0 (CameraRig's auto-frame effect deliberately skips that
  // value -- nothing has loaded yet) and increments each time a model
  // actually finishes loading, including switching to a different one.
  // See CameraRig's own comment for why this exists instead of just
  // keying off modelUrl directly.
  const [sceneVersion, setSceneVersion] = useState(0)
  const baseLight = BASE_LIGHT_CONFIGS[lightingPreset]
  const lightformers = LIGHTFORMER_CONFIGS[lightingPreset]

  useImperativeHandle(
    ref,
    () => ({
      focusOnGlobalIds: (globalIds: string[]) => {
        focusHandlerRef.current?.(globalIds)
      },
    }),
    [],
  )

  return (
    <Canvas camera={{ position: [CAMERA_DISTANCE, CAMERA_DISTANCE, CAMERA_DISTANCE], fov: 50 }}>
      <ambientLight intensity={baseLight.ambientIntensity} />
      <directionalLight position={[10, 10, 5]} intensity={baseLight.directionalIntensity} color={baseLight.directionalColor} />
      <Suspense fallback={null}>
        {/* Without this, PBR materials (glass, metal, anything glossy)
            have nothing to reflect and render flat regardless of what
            the source file actually specifies -- an ambient + one
            directional light is enough to see shapes and colors, but not
            enough for a material to look like its real substance.
            Built from Lightformer panels (plain rectangles of light)
            instead of a preset HDR image deliberately: drei's presets are
            fetched from an external CDN at runtime, and that fetch
            hanging or failing (slow/restricted networks, the CDN being
            unreachable) was found to silently blank the *entire* model,
            not just the lighting, because Environment and Model share
            this Suspense boundary. Lightformers are plain geometry generated
            entirely on-device, so there is nothing to fetch and nothing
            that can hang. Not shown as a visible background/skybox
            (background defaults to false), just used as a lighting
            source. The actual panel configuration per mood
            (daylight/evening/studio) lives in types/LightingPreset.ts,
            re-keyed here so this component doesn't need to know the
            preset's internals. See docs/features/lighting-presets.md. */}
        <Environment key={lightingPreset} resolution={256}>
          {lightformers.map((formatter, index) => (
            <Lightformer
              key={index}
              intensity={formatter.intensity}
              color={formatter.color}
              position={formatter.position}
              rotation={formatter.rotation}
              scale={formatter.scale}
            />
          ))}
        </Environment>
        <Model
          modelUrl={modelUrl}
          scalePreset={scalePreset}
          onElementSelect={onElementSelect}
          hiddenGlobalIds={hiddenGlobalIds}
          onSceneReady={(scene) => {
            sceneRef.current = scene
            setSceneVersion((current) => current + 1)
          }}
        />
      </Suspense>
      <CameraRig sceneRef={sceneRef} sceneVersion={sceneVersion} focusHandlerRef={focusHandlerRef} />
    </Canvas>
  )
})
