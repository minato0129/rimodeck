import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiFetch } from './api'

// 傾聴者から届いた質問
export type Question = {
  id: number
  page: number // どのスライドへの質問か
  content: string
  answered: boolean
  created_at: string
}

export const MAX_QUESTION_LENGTH = 200

async function fetchQuestions(pdfPath: string, signal: AbortSignal): Promise<Question[]> {
  const response = await apiFetch(`/questions?pdf_path=${encodeURIComponent(pdfPath)}`, { signal })
  if (!response.ok) throw new ApiError(response.status, `HTTP error! status: ${response.status}`)
  return (await response.json()) ?? []
}

async function post(path: string, body: unknown): Promise<void> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new ApiError(response.status, `HTTP error! status: ${response.status}`)
}

// 発表者側: この PDF への質問の一覧。新着は addQuestion で足す(WebSocket から届いたもの)。
// - 届いたとき、画面を見ていなかった質問の数を unseen に数える(パネルを開いたら markSeen で 0 に戻す)
export function useQuestions(pdfPath: string, enabled = true) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [failed, setFailed] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const [latest, setLatest] = useState<Question | null>(null) // 直近に届いた質問(通知の表示用。5秒で消える)
  const panelOpen = useRef(false)
  const latestTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(latestTimer.current), [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    fetchQuestions(pdfPath, controller.signal)
      .then((list) => {
        setFailed(false)
        // 読み込み中に WebSocket で届いた質問と、重ならないようにまとめる
        setQuestions((prev) => {
          const byId = new Map(list.map((q) => [q.id, q]))
          for (const q of prev) if (!byId.has(q.id)) byId.set(q.id, q)
          return sortQuestions([...byId.values()])
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error('Failed to load questions:', error)
        setFailed(true)
      })
    return () => controller.abort()
  }, [pdfPath, enabled])

  const addQuestion = useCallback((q: Question) => {
    setQuestions((prev) => (prev.some((x) => x.id === q.id) ? prev : sortQuestions([...prev, q])))
    if (!panelOpen.current) setUnseen((n) => n + 1)
    // 通知は、しばらくしたら自動で消す
    setLatest(q)
    window.clearTimeout(latestTimer.current)
    latestTimer.current = window.setTimeout(() => setLatest(null), 5000)
  }, [])

  const setPanelOpen = useCallback((open: boolean) => {
    panelOpen.current = open
    if (open) {
      setUnseen(0)
      setLatest(null)
    }
  }, [])

  const toggleAnswered = useCallback(async (id: number, answered: boolean) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, answered } : q)))
    try {
      await post('/question/answered', { id, answered })
    } catch (error) {
      console.error('Failed to update question:', error)
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, answered: !answered } : q)))
    }
  }, [])

  const remove = useCallback(async (id: number) => {
    try {
      await post('/question/delete', { id })
      setQuestions((prev) => prev.filter((q) => q.id !== id))
    } catch (error) {
      // すでに消えている(404)ときも、一覧からは外す
      if (error instanceof ApiError && error.status === 404) setQuestions((prev) => prev.filter((q) => q.id !== id))
      else console.error('Failed to delete question:', error)
    }
  }, [])

  return { questions, failed, unseen, latest, addQuestion, setPanelOpen, toggleAnswered, remove }
}

// ページ順、同じページなら届いた順
function sortQuestions(list: Question[]): Question[] {
  return [...list].sort((a, b) => a.page - b.page || a.id - b.id)
}

// 傾聴者側: 質問を送る(ログイン不要。共有リンクのトークンが鍵)。失敗したら、理由の文章を持つ Error を投げる
export async function sendQuestion(token: string, page: number, content: string): Promise<void> {
  const response = await fetch(`/shared/${encodeURIComponent(token)}/question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, content }),
  })
  if (response.ok) return
  let message = '質問を送れませんでした。'
  try {
    const body: { error?: string } = await response.json()
    if (body.error) message = body.error
  } catch {
    // サーバーから理由が返らないときは、上の文章を使う
  }
  throw new Error(message)
}
