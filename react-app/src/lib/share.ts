import { ApiError, apiFetch } from './api'

// 傾聴者共有を始める。共有リンク用のトークンが返る(同じ PDF を共有中なら、前と同じトークン)
export async function startShare(pdfPath: string, viewerId: string, page: number): Promise<string> {
  const response = await apiFetch('/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf_path: pdfPath, viewer_id: viewerId, page }),
  })
  if (!response.ok) throw new ApiError(response.status, '共有を始められませんでした。')
  const body: { token: string } = await response.json()
  return body.token
}

export async function stopShare(): Promise<void> {
  const response = await apiFetch('/share/stop', { method: 'POST' })
  if (!response.ok) throw new ApiError(response.status, '共有を止められませんでした。')
}

// 傾聴者が開く URL
export function watchUrl(token: string): string {
  return `${location.origin}/watch/${token}`
}
