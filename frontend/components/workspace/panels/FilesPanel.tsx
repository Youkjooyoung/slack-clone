'use client'

import { useQuery } from '@tanstack/react-query'
import { fileApi } from '@/lib/api'
import type { FileItem } from '@/types'
import styles from './panel.module.css'

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('word')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  return '📁'
}

export function FilesPanel() {
  const { data: files = [], isLoading } = useQuery<FileItem[]>({
    queryKey: ['my-files'],
    queryFn: () => fileApi.getMyFiles().then((r) => r.data.data),
    staleTime: 60_000,
  })

  return (
    <div className={styles.panel}>
      <div className={styles.panelScroll}>
        <div className={styles.sectionLabel}>내 파일</div>

        {isLoading && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>⏳</span>
            불러오는 중...
          </div>
        )}

        {!isLoading && files.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📁</span>
            업로드된 파일이 없습니다
          </div>
        )}

        {files.map((f) => (
          <div
            key={f.attachmentId}
            className={styles.fileItem}
            onClick={() => window.open(f.fileUrl, '_blank', 'noopener,noreferrer')}
            title={f.fileName}
          >
            <div className={styles.fileIcon}>{getFileIcon(f.mimeType)}</div>
            <div className={styles.fileInfo}>
              <p className={styles.fileName}>{f.fileName}</p>
              <p className={styles.fileMeta}>
                {formatBytes(f.fileSize)} · {formatDate(f.uploadedAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
