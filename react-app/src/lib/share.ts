import { ApiError, apiFetch } from './api'

// 聞き手への共有を始める。共有リンク用のトークンが返る(同じ PDF を共有中なら、前と同じトークン)
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

// この PDF を共有中か(画面を再読み込みしたあと、共有を引き継ぐために使う)
export async function isSharing(pdfPath: string): Promise<boolean> {
  const response = await apiFetch(`/share?pdf_path=${encodeURIComponent(pdfPath)}`)
  if (!response.ok) return false
  const body: { active: boolean } = await response.json()
  return body.active
}

export async function stopShare(): Promise<void> {
  const response = await apiFetch('/share/stop', { method: 'POST' })
  if (!response.ok) throw new ApiError(response.status, '共有を止められませんでした。')
}

// 聞き手が開く URL
export function watchUrl(token: string): string {
  return `${location.origin}/watch/${token}`
}

// このアドレスのままだと、聞き手のスマホからは開けない(スマホにとっての localhost は、スマホ自身になる)
export function isLocalOrigin(): boolean {
  const host = location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host.endsWith('.localhost')
}
