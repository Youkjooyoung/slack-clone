'use client'

import { useRef, useState, useCallback, DragEvent, ReactNode } from 'react'
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload'
import styles from './FileUploadDropzone.module.css'

interface FileUploadDropzoneProps {
  children: ReactNode
  onFilesChange: (files: UploadedFile[]) => void
  inputId?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('word')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  return '📎'
}

export function FileUploadDropzone({ children, onFilesChange, inputId = 'file-upload-input' }: FileUploadDropzoneProps) {
  const { uploadedFiles, isUploading, progress, error, upload, removeFile, reset } =
    useFileUpload()
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files)
      for (const file of arr) {
        const result = await upload(file)
        if (result) onFilesChange([...uploadedFiles, result])
      }
    },
    [upload, uploadedFiles, onFilesChange]
  )

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const handleRemove = (attachmentId: string) => {
    removeFile(attachmentId)
    const next = uploadedFiles.filter((f) => f.attachment.attachmentId !== attachmentId)
    onFilesChange(next)
  }

  ;(FileUploadDropzone as { triggerInput?: () => void }).triggerInput = () => {
    document.getElementById('file-upload-input')?.click()
  }

  return (
    <div
      className={styles.dropzone}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isDragging && (
        <div className={styles.dropOverlay}>
          <span className={styles.dropOverlayText}>여기에 파일을 놓으세요</span>
        </div>
      )}

      <input
        id={inputId}
        type="file"
        className={styles.hiddenInput}
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {uploadedFiles.length > 0 && (
        <div className={styles.previewList}>
          {uploadedFiles.map((uf) => (
            <div key={uf.attachment.attachmentId} className={styles.previewItem}>
              {uf.previewUrl ? (
                <img
                  src={uf.previewUrl}
                  alt={uf.file.name}
                  className={styles.previewImage}
                />
              ) : (
                <span className={styles.fileIcon}>{fileIcon(uf.file.type)}</span>
              )}
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{uf.file.name}</span>
                <span className={styles.fileSize}>{formatBytes(uf.file.size)}</span>
              </div>
              <button
                className={styles.removeBtn}
                onClick={() => handleRemove(uf.attachment.attachmentId)}
                title="제거"
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {isUploading && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className={styles.errorMsg}>{error}</p>}

      {children}
    </div>
  )
}

export { useFileUpload }
