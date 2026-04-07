import { Sidebar } from '@/components/workspace/Sidebar'
import styles from './layout.module.css'

interface Props {
  children: React.ReactNode
  params: { id: string }
}

export default function WorkspaceLayout({ children, params }: Props) {
  return (
    <div className={styles.layout}>
      <Sidebar workspaceId={params.id} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
