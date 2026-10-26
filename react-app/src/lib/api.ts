import { getUsername } from './session'

// サーバーは Cookie の username を先に見て、なければ X-Username ヘッダーを見る。
// 現行版と同じく両方に対応できるよう、ヘッダーも付ける。
export function authHeaders(): Record<string, string> {
  const name = getUsername()
  return name ? { 'X-Username': name } : {}
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// PDF の URL の配列(例: ["/assets/foo.pdf"])を返す
export async function fetchPdfs(): Promise<string[]> {
  const response = await fetch('/pdfs', { headers: authHeaders() })
  if (!response.ok) throw new ApiError(response.status, `HTTP error! status: ${response.status}`)
  return response.json()
}

export async function uploadPdf(file: File): Promise<void> {
  const formData = new FormData()
  formData.append('pdf_file', file) // サーバー側のフィールド名と一致させる
  const response = await fetch('/upload', { method: 'POST', headers: authHeaders(), body: formData })
  if (!response.ok) throw new ApiError(response.status, await response.text())
}

export async function deletePdf(pdfPath: string): Promise<void> {
  const response = await fetch('/delete-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ pdf_path: pdfPath }),
  })
  if (!response.ok) throw new ApiError(response.status, await response.text())
}

export async function logoutRequest(): Promise<void> {
  await fetch('/logout', { method: 'POST' })
}

export function fileNameOf(pdfUrl: string): string {
  return pdfUrl.split('/').pop() ?? pdfUrl
}
