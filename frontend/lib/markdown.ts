import DOMPurify from 'isomorphic-dompurify'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderMarkdown(text: string): string {
  const urls: string[] = []
  let processed = text.replace(/https?:\/\/[^\s<>"']+/g, (match) => {
    urls.push(match)
    return `__URL_PLACEHOLDER_${urls.length - 1}__`
  })

  processed = escapeHtml(processed)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(?<![a-zA-Z0-9\/_])_(.+?)_(?![a-zA-Z0-9\/_])/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')

  processed = processed.replace(/__URL_PLACEHOLDER_(\d+)__/g, (_, idx) => {
    const url = urls[Number(idx)]
    const escaped = escapeHtml(url)
    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer" style="color:#1264a3;text-decoration:none">${escaped}</a>`
  })

  return DOMPurify.sanitize(processed, {
    ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'br', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
    ALLOWED_URI_REGEXP: /^https?:\/\//,
  })
}
