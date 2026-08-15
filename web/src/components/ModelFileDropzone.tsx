import { useState, type DragEvent } from 'react'
import { isFbxFile } from '../viewer/isFbxFile'
import { formatBytes } from '../utils/formatBytes'
import formStyles from '../styles/form.module.css'
import styles from './ModelFileDropzone.module.css'

// One control for both the "model file" (glTF/GLB/FBX) and "IFC file"
// slots, replacing what used to be two separate <input type="file">
// blocks in every upload form (ProjectCreateForm.tsx, AdminProjectModels
// .tsx's AddModelForm and ModelEditForm, pages/LocalPreview.tsx) --
// the owner's own ask, 2026-08-15: "I see 2 different buttons to add
// file just complete everything in 1... add a move and drop features
// for desktop." A single drop target (or file-picker click) accepts
// any mix of files at once and sorts them by extension into the right
// slot -- .ifc goes to the IFC slot, .glb/.gltf/.fbx goes to the model
// slot -- so dropping a model file and its IFC data file together in
// one drag still fills both slots correctly, the same dual-file
// capability the two-input version had.
interface ModelFileDropzoneProps {
  id: string
  modelFile: File | null
  ifcFile: File | null
  onModelFileChange: (file: File | null) => void
  onIfcFileChange: (file: File | null) => void
  includeTextures: boolean
  onIncludeTexturesChange: (value: boolean) => void
  // Only true for the two "new upload" flows (ProjectCreateForm,
  // AddModelForm), where giving just an IFC file really does mean "build
  // the 3D view from this IFC's own geometry." False for a "replace
  // file" context (ModelEditForm) -- there, an IFC-only selection just
  // swaps the tap-to-inspect data and leaves the model's existing
  // geometry untouched, so that hint would be actively wrong there.
  showBuildFromIfcHint?: boolean
}

function classifyFiles(files: FileList | File[]): { model?: File; ifc?: File } {
  let model: File | undefined
  let ifc: File | undefined
  for (const file of Array.from(files)) {
    if (/\.ifc$/i.test(file.name)) {
      ifc = file
    } else if (/\.(glb|gltf|fbx)$/i.test(file.name)) {
      model = file
    }
    // Anything else (a stray non-model file dropped by mistake) is
    // silently ignored -- not worth an error UI for a drop target this
    // permissive by design.
  }
  return { model, ifc }
}

export function ModelFileDropzone({
  id,
  modelFile,
  ifcFile,
  onModelFileChange,
  onIfcFileChange,
  includeTextures,
  onIncludeTexturesChange,
  showBuildFromIfcHint = true,
}: ModelFileDropzoneProps) {
  const [dragging, setDragging] = useState(false)

  function applyFiles(files: FileList | File[]) {
    const { model, ifc } = classifyFiles(files)
    if (model) onModelFileChange(model)
    if (ifc) onIfcFileChange(ifc)
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length > 0) applyFiles(event.dataTransfer.files)
  }

  return (
    <div className={styles.wrapper}>
      <label
        htmlFor={id}
        className={dragging ? styles.dropAreaActive : styles.dropArea}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          id={id}
          type="file"
          multiple
          accept=".glb,.gltf,.fbx,.ifc"
          className={styles.hiddenInput}
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) applyFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <span className={styles.dropIcon} aria-hidden="true">
          ⬆
        </span>
        <span className={styles.dropText}>
          <strong>Click to choose files</strong> or drag and drop
        </span>
        <span className={styles.dropHint}>Model file (glTF / GLB / FBX) and/or an IFC file, together or separate</span>
      </label>

      {(modelFile || ifcFile) && (
        <div className={styles.chips}>
          {modelFile && (
            <FileChip file={modelFile} onRemove={() => onModelFileChange(null)} />
          )}
          {ifcFile && <FileChip file={ifcFile} onRemove={() => onIfcFileChange(null)} />}
        </div>
      )}

      {modelFile && isFbxFile(modelFile) && (
        <label className={formStyles.checkboxLabel}>
          <input type="checkbox" checked={includeTextures} onChange={(event) => onIncludeTexturesChange(event.target.checked)} />
          Include textures and materials from this FBX file
        </label>
      )}

      {showBuildFromIfcHint && !modelFile && ifcFile && (
        <p className={formStyles.subtitle}>
          No model file given — we'll build the 3D view straight from this IFC file when you submit.
          Materials will show as flat colors, not real textures, since IFC doesn't carry those.
        </p>
      )}
    </div>
  )
}

function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <span className={styles.chip}>
      <span className={styles.chipName}>{file.name}</span>
      <span className={styles.chipSize}>{formatBytes(file.size)}</span>
      <button type="button" className={styles.chipRemove} onClick={onRemove} aria-label={`Remove ${file.name}`}>
        ✕
      </button>
    </span>
  )
}
