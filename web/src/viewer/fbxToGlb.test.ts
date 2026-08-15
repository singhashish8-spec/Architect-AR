import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

const parseMock = vi.fn()
const parseAsyncMock = vi.fn()

vi.mock('three-stdlib', () => ({
  FBXLoader: class {
    manager: THREE.LoadingManager
    constructor(manager: THREE.LoadingManager) {
      this.manager = manager
    }
    parse(...args: unknown[]): THREE.Object3D {
      return parseMock(this.manager, ...args) as THREE.Object3D
    }
  },
  GLTFExporter: class {
    parseAsync(...args: unknown[]): Promise<ArrayBuffer> {
      return parseAsyncMock(...args) as Promise<ArrayBuffer>
    }
  },
}))

vi.mock('../services/projectService', () => ({
  uploadModelFile: vi.fn().mockResolvedValue('https://pub.example/converted.glb'),
}))

function meshWithTexture(): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() })
  return new THREE.Mesh(new THREE.BufferGeometry(), material)
}

beforeEach(() => {
  parseMock.mockReset()
  parseAsyncMock.mockReset().mockResolvedValue(new ArrayBuffer(8))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('convertFbxToGlb', () => {
  it('strips texture maps and exports immediately when includeTextures is false', async () => {
    const { convertFbxToGlb } = await import('./fbxToGlb')
    const mesh = meshWithTexture()
    parseMock.mockReturnValue(mesh)

    const file = new File([new ArrayBuffer(4)], 'model.fbx')
    const result = await convertFbxToGlb(file, { includeTextures: false })

    expect(result.type).toBe('model/gltf-binary')
    const material = mesh.material as THREE.MeshStandardMaterial
    expect(material.map).toBeNull()
    expect(parseAsyncMock).toHaveBeenCalledWith(mesh, { binary: true })
  })

  it('resolves without hanging when includeTextures is true but the FBX has no textures', async () => {
    const { convertFbxToGlb } = await import('./fbxToGlb')
    const root = new THREE.Group()
    // Never calls manager.itemStart() -- a texture-less FBX.
    parseMock.mockReturnValue(root)

    const file = new File([new ArrayBuffer(4)], 'model.fbx')
    const progressPhases: string[] = []

    await convertFbxToGlb(file, { includeTextures: true }, (p) => progressPhases.push(p.phase))

    expect(progressPhases).toEqual(['parsing', 'loading textures', 'exporting'])
    expect(parseAsyncMock).toHaveBeenCalledWith(root, { binary: true })
  })

  it('waits for the manager to finish loading textures before exporting', async () => {
    const { convertFbxToGlb } = await import('./fbxToGlb')
    const mesh = meshWithTexture()
    let capturedManager: THREE.LoadingManager | null = null
    parseMock.mockImplementation((manager: THREE.LoadingManager) => {
      capturedManager = manager
      manager.itemStart('texture.jpg')
      return mesh
    })

    const file = new File([new ArrayBuffer(4)], 'model.fbx')
    const conversion = convertFbxToGlb(file, { includeTextures: true })

    // Give the "did anything start loading" microtask a chance to run,
    // then finish the texture load -- export should only happen after
    // this, never before.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(parseAsyncMock).not.toHaveBeenCalled()

    capturedManager!.itemEnd('texture.jpg')
    await conversion

    expect(parseAsyncMock).toHaveBeenCalledWith(mesh, { binary: true })
    // Textures were left alone (includeTextures: true) -- the mesh's
    // own material.map is untouched, unlike the includeTextures: false
    // case above.
    expect((mesh.material as THREE.MeshStandardMaterial).map).not.toBeNull()
  })

  it('rejects if a texture fails to load', async () => {
    const { convertFbxToGlb } = await import('./fbxToGlb')
    parseMock.mockImplementation((manager: THREE.LoadingManager) => {
      manager.itemStart('broken.jpg')
      manager.onError?.('broken.jpg')
      return new THREE.Group()
    })

    const file = new File([new ArrayBuffer(4)], 'model.fbx')

    await expect(convertFbxToGlb(file, { includeTextures: true })).rejects.toThrow('broken.jpg')
  })

  it('times out if a texture never finishes loading or erroring', async () => {
    vi.useFakeTimers()
    const { convertFbxToGlb } = await import('./fbxToGlb')
    parseMock.mockImplementation((manager: THREE.LoadingManager) => {
      manager.itemStart('slow.jpg')
      return new THREE.Group()
    })

    const file = new File([new ArrayBuffer(4)], 'model.fbx')
    const conversion = convertFbxToGlb(file, { includeTextures: true })
    const assertion = expect(conversion).rejects.toThrow(/timed out/i)

    await vi.advanceTimersByTimeAsync(31000)
    await assertion
  })
})

describe('uploadModelFileWithConversion', () => {
  it('uploads a non-FBX file directly, with no conversion', async () => {
    const { uploadModelFileWithConversion } = await import('./fbxToGlb')
    const { uploadModelFile } = await import('../services/projectService')
    const file = new File([new ArrayBuffer(4)], 'model.glb')

    const url = await uploadModelFileWithConversion(file, { includeTextures: true })

    expect(url).toBe('https://pub.example/converted.glb')
    expect(uploadModelFile).toHaveBeenCalledWith(file, undefined)
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('converts an FBX file to GLB before uploading', async () => {
    const { uploadModelFileWithConversion } = await import('./fbxToGlb')
    const { uploadModelFile } = await import('../services/projectService')
    parseMock.mockReturnValue(new THREE.Group())
    const file = new File([new ArrayBuffer(4)], 'model.fbx')

    await uploadModelFileWithConversion(file, { includeTextures: false })

    expect(uploadModelFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'model.glb', type: 'model/gltf-binary' }),
      undefined,
    )
  })

  it('forwards an upload-progress callback through to uploadModelFile', async () => {
    const { uploadModelFileWithConversion } = await import('./fbxToGlb')
    const { uploadModelFile } = await import('../services/projectService')
    const file = new File([new ArrayBuffer(4)], 'model.glb')
    const onUploadProgress = vi.fn()

    await uploadModelFileWithConversion(file, { includeTextures: true }, undefined, onUploadProgress)

    expect(uploadModelFile).toHaveBeenCalledWith(file, onUploadProgress)
  })
})
