'use client'

import { useQuery } from '@tanstack/react-query'
import { ogApi } from '@/lib/api'
import styles from './linkPreview.module.css'

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)(\?[^\s]*)?$/i

export function extractPreviewUrl(content: string): string | null {
  const matches = content.match(/https?:\/\/[^\s]+/g)
  if (!matches) return null
  for (const url of matches) {
    if (IMAGE_EXT_RE.test(url)) continue
    if (url.includes('/api/files/serve/')) continue
    return url
  }
  return null
}

interface LinkPreviewProps {
  url: string
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['og-meta', url],
    queryFn: () => ogApi.getMeta(url).then((r) => r.data.data),
    staleTime: 60 * 60 * 1_000,
    retry: false,
  })

  if (isLoading || isError || !data) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      onClick={(e) => e.stopPropagation()}
    >
      {data.imageUrl && (
        <div className={styles.thumbnail}>
          <img
            src={data.imageUrl}
            alt={data.title}
            className={styles.thumbnailImg}
            onError={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.display = 'none'
            }}
          />
        </div>
      )}
      <div className={styles.info}>
        <p className={styles.title}>{data.title}</p>
        {data.description && (
          <p className={styles.description}>{data.description}</p>
        )}
        <p className={styles.urlText}>{new URL(url).hostname}</p>
      </div>
    </a>
  )
}
