import { clearUsername } from './session'

// ログインの本人確認は、サーバーが発行する Cookie(token)で行う(ブラウザが自動で送る)。
// Cookie の期限が切れたなどで 401 が返ったら、保存したユーザー名を消してログイン画面に戻す。
// (ログイン・新規登録の 401 は「パスワードが違う」なので、この関数は使わない)
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init)
  if (response.status === 401) {
    clearUsername()
    if (location.pathname !== '/login') location.assign('/login')
  }
  return response
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
  const response = await apiFetch('/pdfs')
  if (!response.ok) throw new ApiError(response.status, `HTTP error! status: ${response.status}`)
  // PDF が1つもないとき、サーバーは [] ではなく null を返すことがある。空の一覧として扱う。
  const list: string[] | null = await response.json()
  return list ?? []
}

export async function uploadPdf(file: File): Promise<void> {
  const formData = new FormData()
  formData.append('pdf_file', file) // サーバー側のフィールド名と一致させる
  const response = await apiFetch('/upload', { method: 'POST', body: formData })
  if (!response.ok) throw new ApiError(response.status, await response.text())
}

export async function deletePdf(pdfPath: string): Promise<void> {
  const response = await apiFetch('/delete-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
