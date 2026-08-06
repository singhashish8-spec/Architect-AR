import { Suspense } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import type { ScalePreset } from '../types/ScalePreset'
import { visualScale } from '../types/ScalePreset'

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
}: {
  modelUrl: string
  scalePreset: ScalePreset
  onElementSelect?: (globalId: string) => void
}) {
  const { scene } = useGLTF(modelUrl)

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

export function ModelViewer({ modelUrl, scalePreset, onElementSelect }: ModelViewerProps) {
  return (
    <Canvas camera={{ position: [CAMERA_DISTANCE, CAMERA_DISTANCE, CAMERA_DISTANCE], fov: 50 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Model modelUrl={modelUrl} scalePreset={scalePreset} onElementSelect={onElementSelect} />
      </Suspense>
      <OrbitControls />
    </Canvas>
  )
}
