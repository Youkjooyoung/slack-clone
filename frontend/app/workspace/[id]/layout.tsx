import { Sidebar } from '@/components/workspace/Sidebar'
import styles from './layout.module.css'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const { id } = await params
  return (
    <div className={styles.layout}>
      <Sidebar workspaceId={id} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
