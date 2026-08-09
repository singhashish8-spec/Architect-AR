import { forwardRef, Suspense, useEffect, useImperativeHandle, useRef } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { resolveNodeNameToExpressId } from '../ifc/ifcPropertyLookup'
import type { ScalePreset } from '../types/ScalePreset'
import { visualScale } from '../types/ScalePreset'

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
}

function Model({
  modelUrl,
  scalePreset,
  onElementSelect,
  onSceneReady,
}: {
  modelUrl: string
  scalePreset: ScalePreset
  onElementSelect?: (globalId: string) => void
  onSceneReady: (scene: THREE.Object3D) => void
}) {
  const { scene } = useGLTF(modelUrl)

  useEffect(() => {
    onSceneReady(scene)
  }, [scene, onSceneReady])

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

// Lives inside <Canvas> (unlike ModelViewer itself) since framing the
// camera needs useThree() for the live camera instance, which only works
// inside the R3F tree. Exposes its one-shot "focus" action back out to
// ModelViewer's forwardRef via a plain ref callback rather than its own
// useImperativeHandle, since this component isn't the one the caller
// holds a ref to.
function CameraRig({
  sceneRef,
  focusHandlerRef,
}: {
  sceneRef: React.RefObject<THREE.Object3D | null>
  focusHandlerRef: React.RefObject<((globalIds: string[]) => void) | null>
}) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsImpl>(null)

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

      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      // The floor here only exists to avoid a zero/degenerate radius (a
      // single flat-thickness mesh) -- it must NOT be a fixed real-world
      // size like "0.5 units". visualScale() (see types/ScalePreset.ts)
      // shrinks the whole model's geometry by the scale preset's ratio,
      // so a real room's actual bounding box in scene units is already
      // proportionally tiny at anything other than 1:1 -- a fixed 0.5
      // floor silently dominated every room's real size at 1:100 or
      // smaller, making every "jump to" land at roughly the same
      // distance regardless of which room was clicked (this is exactly
      // what the owner hit testing live: the list worked, the jump
      // didn't visibly move).
      const radius = Math.max(size.x, size.y, size.z, 1e-6)

      const viewDirection = camera.position.clone().sub(controls.target)
      viewDirection.normalize().multiplyScalar(radius * 2.2)
      camera.position.copy(center.clone().add(viewDirection))
      camera.lookAt(center)
      controls.target.copy(center)
      controls.update()
    }
  }, [camera, sceneRef, focusHandlerRef])

  return <OrbitControls ref={controlsRef} />
}

export const ModelViewer = forwardRef<ModelViewerHandle, ModelViewerProps>(function ModelViewer(
  { modelUrl, scalePreset, onElementSelect },
  ref,
) {
  const sceneRef = useRef<THREE.Object3D | null>(null)
  const focusHandlerRef = useRef<((globalIds: string[]) => void) | null>(null)

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
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model
          modelUrl={modelUrl}
          scalePreset={scalePreset}
          onElementSelect={onElementSelect}
          onSceneReady={(scene) => {
            sceneRef.current = scene
          }}
        />
      </Suspense>
      <CameraRig sceneRef={sceneRef} focusHandlerRef={focusHandlerRef} />
    </Canvas>
  )
})
