import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiFetch } from './api'

// スライドのあるページに紐付けた動画(1ページにつき1本)
export type PageVideo = { id: number; page: number; name: string; created_at: string }

// アップロードできる動画の上限(go-server の maxVideoSize と同じ)
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov'

// 差し替えたときに、ブラウザが前の動画のキャッシュを使わないよう、登録した時刻を URL に付ける
function version(video: PageVideo): string {
  return String(Date.parse(video.created_at) || 0)
}

// 発表者(ログイン済み)が動画を取得する URL
export function videoUrl(pdfPath: string, video: PageVideo): string {
  return `/video/${video.id}?pdf_path=${encodeURIComponent(pdfPath)}&v=${version(video)}`
}

// 聞き手(ログイン不要)が、共有リンクのトークンで動画を取得する URL
export function sharedVideoUrl(token: string, video: PageVideo): string {
  return `/shared/${encodeURIComponent(token)}/video/${video.id}?v=${version(video)}`
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: { error?: string } = await response.json()
    if (body.error) return body.error
  } catch {
    // JSON ではない応答は、既定のメッセージを使う
  }
  return fallback
}

export async function fetchVideos(pdfPath: string): Promise<PageVideo[]> {
  const response = await apiFetch(`/videos?pdf_path=${encodeURIComponent(pdfPath)}`)
  if (!response.ok) throw new ApiError(response.status, '動画の一覧を取得できませんでした。')
  return (await response.json()) ?? []
}

// そのページに動画を紐付ける(あれば差し替え)。最新の一覧が返る
export async function uploadVideo(pdfPath: string, page: number, file: File): Promise<PageVideo[]> {
  const form = new FormData()
  form.append('pdf_path', pdfPath)
  form.append('page', String(page))
  form.append('video_file', file)
  const response = await apiFetch('/video', { method: 'POST', body: form })
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response, 'アップロードに失敗しました。'))
  return (await response.json()) ?? []
}

export async function deleteVideo(pdfPath: string, page: number): Promise<void> {
  const response = await apiFetch('/video/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf_path: pdfPath, page }),
  })
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response, '削除に失敗しました。'))
}

function byPageMap(videos: PageVideo[]): Map<number, PageVideo> {
  return new Map(videos.map((v) => [v.page, v]))
}

// 発表者側(Viewer・発表者モード)で、その PDF に紐付いた動画を扱う
export function useVideos(pdfPath: string) {
  const [videos, setVideos] = useState<PageVideo[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchVideos(pdfPath)
      .then((list) => !cancelled && setVideos(list))
      .catch((e) => console.error('Failed to load videos:', e))
    return () => {
      cancelled = true
    }
  }, [pdfPath])

  const upload = useCallback(
    async (page: number, file: File) => {
      if (file.size > MAX_VIDEO_BYTES) {
        setError('動画のサイズが500MBを超えています。')
        return
      }
      setBusy(true)
      setError(null)
      try {
        setVideos(await uploadVideo(pdfPath, page, file))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'アップロードに失敗しました。')
      } finally {
        setBusy(false)
      }
    },
    [pdfPath],
  )

  const remove = useCallback(
    async (page: number) => {
      setBusy(true)
      setError(null)
      try {
        await deleteVideo(pdfPath, page)
        setVideos((list) => list.filter((v) => v.page !== page))
      } catch (e) {
        setError(e instanceof Error ? e.message : '削除に失敗しました。')
      } finally {
        setBusy(false)
      }
    },
    [pdfPath],
  )

  const byPage = useMemo(() => byPageMap(videos), [videos])
  return { videos, byPage, busy, error, upload, remove }
}

// 聞き手側で、共有中の PDF に紐付いた動画を取得する。接続し直したとき(発表中に動画が増えたかもしれない)も取り直す
export function useSharedVideos(token: string, live: boolean) {
  const [videos, setVideos] = useState<PageVideo[]>([])

  useEffect(() => {
    if (!live) return
    let cancelled = false
    fetch(`/shared/${encodeURIComponent(token)}/videos`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: PageVideo[] | null) => !cancelled && setVideos(list ?? []))
      .catch((e) => console.error('Failed to load videos:', e))
    return () => {
      cancelled = true
    }
  }, [token, live])

  return useMemo(() => byPageMap(videos), [videos])
}
