import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiFetch } from './api'

async function fetchNote(pdfPath: string, page: number, signal: AbortSignal): Promise<string> {
  const response = await apiFetch(`/note?pdf_path=${encodeURIComponent(pdfPath)}&page_index=${page}`, { signal })
  if (!response.ok) throw new ApiError(response.status, `HTTP error! status: ${response.status}`)
  const data = await response.json()
  return data.content || ''
}

async function saveNoteRequest(pdfPath: string, page: number, content: string): Promise<void> {
  const response = await apiFetch('/note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf_path: pdfPath, page_index: page, content }),
  })
  if (!response.ok) throw new ApiError(response.status, `HTTP error! status: ${response.status}`)
}

type Pending = { page: number; content: string }

const SAVE_DELAY_MS = 1000

// スライドごとのメモ。
// - ページが変わったら、そのページのメモを読み込む
// - 入力が1秒止まったら保存する(保存できたら onSaved を呼ぶ)
// - 保存を待たずにページが変わっても、入力したページに保存する
//   (現行版は、保存の瞬間のページ番号を使うため、その間にページが変わると入力が失われていた)
export function useNote(pdfPath: string, page: number, onSaved: () => void, enabled = true) {
  const key = `${pdfPath}#${page}`
  const [loaded, setLoaded] = useState<{ key: string; text: string } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const pending = useRef<Pending | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const saving = useRef<Promise<void>>(Promise.resolve())

  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  })

  // 未保存の入力があれば、いますぐ保存する
  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const p = pending.current
    pending.current = null
    if (!p) return
    saving.current = saveNoteRequest(pdfPath, p.page, p.content)
      .then(() => onSavedRef.current())
      .catch((error) => console.error('Failed to save note:', error))
  }, [pdfPath])

  // 読み込み。ページが変わる・閉じるときは、先に未保存の入力を保存する。
  // 読み込みは直前の保存が終わってから行う(古い内容で上書きされないように)。
  useEffect(() => {
    if (page < 1 || !enabled) return
    const controller = new AbortController()
    saving.current
      .then(() => fetchNote(pdfPath, page, controller.signal))
      .then((text) => setLoaded({ key, text }))
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Failed to load note:', error)
        setFailedKey(key)
      })
    return () => {
      controller.abort() // 前のページの応答が遅れて届いても、反映しない
      flush()
    }
  }, [pdfPath, page, key, reloadTick, flush, enabled])

  const change = useCallback(
    (value: string) => {
      setLoaded({ key, text: value })
      pending.current = { page, content: value }
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS)
    },
    [key, page, flush],
  )

  const reload = useCallback(() => setReloadTick((t) => t + 1), [])

  const isLoaded = loaded?.key === key
  // 読み込みに失敗したページでは、既存のメモを上書きしてしまわないよう、入力できないままにして理由を表示する
  return { text: isLoaded ? loaded.text : '', loading: !isLoaded, failed: !isLoaded && failedKey === key, change, reload }
}
