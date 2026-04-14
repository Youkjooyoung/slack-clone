'use client'

import { useState, useCallback } from 'react'
import axios, { AxiosError } from 'axios'
import { useAuthStore } from '@/store/authStore'
import type { Attachment } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export interface UploadedFile {
  attachment: Attachment
  file: File
  previewUrl: string | null
}

interface UseFileUploadReturn {
  uploadedFiles: UploadedFile[]
  isUploading: boolean
  progress: number
  error: string | null
  upload: (file: File) => Promise<UploadedFile | null>
  removeFile: (attachmentId: string) => void
  reset: () => void
}

const ALLOWED_TYPES: Record<string, 'image' | 'document'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
}

const IMAGE_MAX = 5 * 1024 * 1024   // 5MB
const DOC_MAX  = 20 * 1024 * 1024  // 20MB

function validateFile(file: File): string | null {
  const category = ALLOWED_TYPES[file.type]
  if (!category) return '지원하지 않는 파일 형식입니다. (이미지: jpg/png/gif/webp, 문서: pdf/doc/xlsx)'
  if (category === 'image' && file.size > IMAGE_MAX) return `이미지 파일 크기는 5MB 이하여야 합니다.`
  if (category === 'document' && file.size > DOC_MAX) return `문서 파일 크기는 20MB 이하여야 합니다.`
  return null
}

export function useFileUpload(): UseFileUploadReturn {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File): Promise<UploadedFile | null> => {
    setError(null)

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return null
    }

    setIsUploading(true)
    setProgress(0)

    try {
      const token = useAuthStore.getState().accessToken
      const formData = new FormData()
      formData.append('file', file)

      const { data: localData } = await axios.post<{ success: boolean; data: Attachment }>(
        `${API_BASE}/api/files/upload/local`,
        formData,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          onUploadProgress: (e) => {
            if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
          },
        }
      )
      const attachment = localData.data

      // 이미지 미리보기 URL 생성
      const previewUrl = ALLOWED_TYPES[file.type] === 'image'
        ? URL.createObjectURL(file)
        : null

      const uploaded: UploadedFile = { attachment, file, previewUrl }
      setUploadedFiles((prev) => [...prev, uploaded])
      setProgress(100)
      return uploaded
    } catch (err) {
      console.error('[useFileUpload] 업로드 실패:', err)
      const axiosErr = err as AxiosError<{ message?: string }>
      const message =
        axiosErr.response?.data?.message ??
        (err instanceof Error ? err.message : '파일 업로드에 실패했습니다.')
      setError(message)
      return null
    } finally {
      setIsUploading(false)
    }
  }, [])

  const removeFile = useCallback((attachmentId: string) => {
    setUploadedFiles((prev) => {
      const target = prev.find((f) => f.attachment.attachmentId === attachmentId)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((f) => f.attachment.attachmentId !== attachmentId)
    })
  }, [])

  const reset = useCallback(() => {
    setUploadedFiles((prev) => {
      prev.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
      return []
    })
    setProgress(0)
    setError(null)
  }, [])

  return { uploadedFiles, isUploading, progress, error, upload, removeFile, reset }
}
