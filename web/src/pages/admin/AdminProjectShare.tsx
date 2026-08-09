import { useOutletContext } from 'react-router-dom'
import { ProjectShareCard } from '../../components/ProjectShareCard'
import { getPublicOrigin } from '../../utils/publicUrl'
import type { AdminProjectPageContext } from './AdminProjectPage'
import styles from './AdminProjectShare.module.css'
import formStyles from '../../styles/form.module.css'

// The same share card/QR code the client-facing view page offers (that
// one stays exactly as-is, unchanged), but reachable directly from
// admin too -- no need to open the project link itself just to grab its
// QR code or copy the link. See docs/features/full-admin-dashboard.md.
export function AdminProjectShare() {
  const { project } = useOutletContext<AdminProjectPageContext>()
  const url = `${getPublicOrigin()}/p/${project.id}`

  return (
    <div>
      {project.hasPasscode && (
        <p className={formStyles.subtitle}>
          This project has a passcode set — whoever you share this link with will also need it to
          get in. Manage the passcode from the Settings tab.
        </p>
      )}
      <div className={styles.cardWrap}>
        <ProjectShareCard url={url} projectName={project.name} description={project.description} variant="embedded" />
      </div>
    </div>
  )
}
