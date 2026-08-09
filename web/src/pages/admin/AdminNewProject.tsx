import { useNavigate, useOutletContext } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ProjectCreateForm } from '../../components/ProjectCreateForm'
import type { AdminContext } from './AdminLayout'
import formStyles from '../../styles/form.module.css'

// Its own page, not a panel squeezed into the list -- room to actually
// fill out a project without the rest of the dashboard competing for
// space. See docs/features/full-admin-dashboard.md.
export function AdminNewProject() {
  const { passcode, refresh } = useOutletContext<AdminContext>()
  const navigate = useNavigate()

  return (
    <main className={formStyles.stack}>
      <div className={formStyles.card}>
        <p className={formStyles.subtitle}>
          <Link to="/admin" className={formStyles.link}>
            ← Back to dashboard
          </Link>
        </p>
        <h1 className={formStyles.title}>New project</h1>
        <ProjectCreateForm
          adminPasscode={passcode}
          onCreated={(id) => {
            void refresh().then(() => void navigate(`/admin/p/${id}`))
          }}
        />
      </div>
    </main>
  )
}
